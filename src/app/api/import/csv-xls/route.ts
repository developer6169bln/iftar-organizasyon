import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function normalizeKey(s: unknown) {
  return String(s ?? '').trim()
}

function truthy(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  return v === true || v === 1 || s === '1' || s === 'true' || s === 'ja' || s === 'yes' || s === 'y'
}

function firstNonEmpty(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const val = row[k]
    if (val === null || val === undefined) continue
    const s = String(val).trim()
    if (s) return s
  }
  return null
}

/** Sucht in row nach Spalten, deren Header zum Muster passen (z. B. /vorname/i) */
function firstNonEmptyByHeaderPattern(
  row: Record<string, unknown>,
  headers: string[],
  pattern: RegExp
): string | null {
  for (const h of headers) {
    if (!pattern.test(h)) continue
    const val = row[h]
    if (val === null || val === undefined) continue
    const s = String(val).trim()
    if (s) return s
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = (formData.get('eventId') as string) || ''
    const append = formData.get('append') === 'true' || formData.get('append') === '1'
    const confirmReplace = (formData.get('confirmReplace') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    }
    if (!eventId) {
      return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
    }

    // Prüfe Dateityp
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isXLS = fileName.endsWith('.xls') || fileName.endsWith('.xlsx')

    if (!isCSV && !isXLS) {
      return NextResponse.json(
        { error: 'Ungültiger Dateityp. Bitte laden Sie eine CSV oder XLS/XLSX Datei hoch.' },
        { status: 400 }
      )
    }

    // Parse (CSV + XLS/XLSX) robust über xlsx, damit Trennzeichen/Quotes passen
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = isCSV
      ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
      : XLSX.read(buffer, { type: 'buffer' })

    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return NextResponse.json({ error: 'Datei enthält kein Sheet' }, { status: 400 })
    }
    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      return NextResponse.json({ error: 'Sheet konnte nicht gelesen werden' }, { status: 400 })
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    })

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Keine Daten in der Datei gefunden' }, { status: 400 })
    }

    // Header-Liste (1:1) für Frontend/Debug, aber ignoriere bestimmte Felder
    const shouldIgnoreHeader = (key: string): boolean => {
      const normalized = key.toLowerCase().trim()
      return (
        normalized === 'auswahl' ||
        normalized === 'einladung e-mail' ||
        normalized === 'einladung e-mail' ||
        normalized === 'einladung post' ||
        normalized === 'einladungspost' ||
        normalized.includes('auswahl') ||
        (normalized.includes('einladung') && (normalized.includes('e-mail') || normalized.includes('email'))) ||
        (normalized.includes('einladung') && normalized.includes('post'))
      )
    }
    const headers = Object.keys(rows[0] || {})
      .map(normalizeKey)
      .filter((h) => h && !shouldIgnoreHeader(h))

    // Beim Anhängen: bestehende Gäste laden; Map (Vorname|Nachname) -> Gast für Doppelprüfung und Aktualisierung fehlender Daten
    const norm = (s: string) => (s ?? '').trim().toLowerCase()
    type ExistingGuest = {
      id: string
      name: string
      email: string | null
      phone: string | null
      title: string | null
      organization: string | null
      tableNumber: number | null
      isVip: boolean
      notes: string | null
      additionalData: Record<string, unknown>
    }
    const existingByKey = new Map<string, ExistingGuest>()
    if (append) {
      const existingGuests = await prisma.guest.findMany({
        where: { eventId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          title: true,
          organization: true,
          tableNumber: true,
          isVip: true,
          notes: true,
          additionalData: true,
        },
      })
      for (const g of existingGuests) {
        let v = ''
        let n = ''
        let add: Record<string, unknown> = {}
        if (g.additionalData) {
          try {
            add = JSON.parse(g.additionalData) as Record<string, unknown>
            v = String(add['Vorname'] ?? add['vorname'] ?? '').trim()
            n = String(add['Nachname'] ?? add['nachname'] ?? '').trim()
            if (!v && !n) {
              for (const [key, val] of Object.entries(add)) {
                const k = key.toLowerCase()
                if ((k.includes('vorname') || k === 'firstname') && val != null && String(val).trim())
                  v = String(val).trim()
                if ((k.includes('nachname') || k === 'lastname' || k === 'familienname') && val != null && String(val).trim())
                  n = String(val).trim()
              }
            }
          } catch {
            // ignore
          }
        }
        if (!v && !n && g.name) {
          const parts = String(g.name).trim().split(/\s+/).filter(Boolean)
          v = parts[0] ?? ''
          n = parts.slice(1).join(' ') ?? ''
        }
        const key = `${norm(v)}|${norm(n)}`
        if (!existingByKey.has(key)) {
          existingByKey.set(key, {
            id: g.id,
            name: g.name ?? '',
            email: g.email ?? null,
            phone: g.phone ?? null,
            title: g.title ?? null,
            organization: g.organization ?? null,
            tableNumber: g.tableNumber ?? null,
            isVip: g.isVip ?? false,
            notes: g.notes ?? null,
            additionalData: add,
          })
        }
      }
    }

    // Beim Ersetzen: Nur mit expliziter Bestätigung (verhindert versehentliches Löschen von Einladungen/Zusagen/Absagen)
    const REPLACE_CONFIRM_CODE = 'ALLE_EINLADUNGEN_UND_GAESTE_LOESCHEN'
    if (!append && confirmReplace !== REPLACE_CONFIRM_CODE) {
      return NextResponse.json(
        {
          error:
            'Import im Modus "Ersetzen" erfordert eine Bestätigung. Bitte die Checkbox bestätigen und den Hinweis lesen.',
          code: 'CONFIRM_REPLACE_REQUIRED',
        },
        { status: 400 }
      )
    }

    // Beim Anhängen: Doppelte aktualisieren (fehlende Daten aus Import ergänzen); neue Einträge anlegen
    const addedInThisImport = new Set<string>()
    const result = await prisma.$transaction(async (tx) => {
      if (!append) {
        await tx.invitation.deleteMany({ where: { eventId } })
        await tx.guest.deleteMany({ where: { eventId } })
      }

      const batchSize = 500
      let totalCreated = 0
      let totalUpdated = 0

      /** Bestehenden Gast mit Werten aus der Import-Zeile ergänzen (nur wo in der Gästeliste noch leer) */
      const mergeIntoExisting = (existing: ExistingGuest, rowData: {
        name: string
        email: string | null
        phone: string | null
        isVip: boolean
        additionalData: Record<string, unknown>
      }): { name: string; email: string | null; phone: string | null; isVip: boolean; additionalData: string } => {
        const name = (existing.name && existing.name !== 'Unbekannt') ? existing.name : rowData.name
        const email = (existing.email && String(existing.email).trim()) ? existing.email : (rowData.email && String(rowData.email).trim()) ? rowData.email : null
        const phone = (existing.phone && String(existing.phone).trim()) ? existing.phone : (rowData.phone && String(rowData.phone).trim()) ? rowData.phone : null
        const isVip = existing.isVip || rowData.isVip
        const mergedAdd: Record<string, unknown> = { ...existing.additionalData }
        for (const [k, v] of Object.entries(rowData.additionalData)) {
          const existingVal = mergedAdd[k]
          const isEmpty = existingVal === null || existingVal === undefined || String(existingVal).trim() === ''
          if (isEmpty && v != null && String(v).trim() !== '') {
            mergedAdd[k] = v
          }
        }
        return { name, email, phone, isVip, additionalData: JSON.stringify(mergedAdd) }
      }

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const data: Array<{
          eventId: string
          name: string
          email: string | null
          phone: string | null
          isVip: boolean
          status: string
          additionalData: string
        }> = []
        const updatesById = new Map<string, ReturnType<typeof mergeIntoExisting>>()

        for (const row of batch) {
          const shouldIgnoreField = (key: string): boolean => {
            const normalized = key.toLowerCase().trim()
            if (
              normalized === 'auswahl' ||
              normalized === 'einladung e-mail' ||
              normalized === 'einladung post' ||
              normalized === 'einladungspost' ||
              normalized === 'einladung e mail'
            )
              return true
            if (
              normalized.includes('auswahl') ||
              (normalized.includes('einladung') && (normalized.includes('e-mail') || normalized.includes('email'))) ||
              (normalized.includes('einladung') && normalized.includes('post'))
            )
              return true
            return false
          }

          const additionalData: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) {
            const key = normalizeKey(k)
            if (!key || shouldIgnoreField(key)) continue
            additionalData[key] = v
          }

          let vorname =
            firstNonEmpty(row, ['Vorname', 'vorname', 'Vorname ', 'FirstName']) ||
            firstNonEmptyByHeaderPattern(row, headers, /vorname|firstname|prenom/i)
          let nachname =
            firstNonEmpty(row, ['Nachname', 'nachname', 'Nachname ', 'LastName', 'Familienname']) ||
            firstNonEmptyByHeaderPattern(row, headers, /nachname|lastname|familienname/i)
          if (!vorname && !nachname) {
            const nameVal =
              firstNonEmpty(row, ['Name', 'name', 'NAME', 'Gast', 'GAST']) ||
              firstNonEmptyByHeaderPattern(row, headers, /^(name|gast|vollständig)$/i) ||
              firstNonEmpty(row, headers)
            if (nameVal) {
              const parts = String(nameVal).trim().split(/\s+/).filter(Boolean)
              vorname = parts[0] ?? ''
              nachname = parts.slice(1).join(' ') ?? ''
            }
          }
          const fullNameFromSplit =
            [vorname, nachname].filter(Boolean).join(' ').trim() || null
          const name =
            firstNonEmpty(row, ['Name', 'name']) ||
            fullNameFromSplit ||
            firstNonEmpty(row, headers) ||
            'Unbekannt'

          const email =
            firstNonEmpty(row, [
              'E-Mail',
              'Email',
              'email',
              'email_kurumsal',
              'email_privat',
              'E-Mail (kurumsal)',
              'E-Mail (privat)',
            ]) || null

          const phone =
            firstNonEmpty(row, ['Telefon', 'telefon', 'Mobil', 'mobil', 'phone', 'Mobilfunk']) || null

          const isVip = truthy(
            (row as any)['VIP'] ?? (row as any)['vip'] ?? (row as any)['IsVip'] ?? (row as any)['isVip']
          )

          const key = `${norm(vorname ?? '')}|${norm(nachname ?? '')}`

          if (append) {
            const existing = existingByKey.get(key)
            if (existing) {
              const payload = mergeIntoExisting(existing, {
                name: name ?? 'Unbekannt',
                email,
                phone,
                isVip,
                additionalData,
              })
              updatesById.set(existing.id, payload)
              existingByKey.set(key, {
                ...existing,
                name: payload.name,
                email: payload.email,
                phone: payload.phone,
                isVip: payload.isVip,
                additionalData: JSON.parse(payload.additionalData) as Record<string, unknown>,
              })
              continue
            }
            if (addedInThisImport.has(key)) continue
            addedInThisImport.add(key)
          }

          data.push({
            eventId,
            name: name ?? 'Unbekannt',
            email,
            phone,
            isVip,
            status: 'INVITED',
            additionalData: JSON.stringify(additionalData),
          })
        }

        for (const [id, payload] of updatesById) {
          await tx.guest.update({
            where: { id },
            data: {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              isVip: payload.isVip,
              additionalData: payload.additionalData,
            },
          })
          totalUpdated += 1
        }
        if (data.length > 0) {
          const res = await tx.guest.createMany({ data })
          totalCreated += res.count
        }
      }

      return { created: totalCreated, updated: totalUpdated }
    })

    const created = result.created
    const updated = result.updated
    const messageParts: string[] = []
    if (append) {
      if (created > 0) messageParts.push(`${created} Einträge angehängt`)
      if (updated > 0) messageParts.push(`${updated} Doppelte mit fehlenden Daten aktualisiert`)
      if (messageParts.length === 0) messageParts.push('Keine neuen Einträge; keine Aktualisierungen.')
    } else {
      messageParts.push(`${created} Gäste erfolgreich importiert`)
    }

    return NextResponse.json({
      success: true,
      message: messageParts.join('; '),
      imported: created,
      updated: updated ?? 0,
      total: rows.length,
      skipped: 0,
      headers,
      append: !!append,
    })
  } catch (error: any) {
    console.error('Import-Fehler:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Importieren der Datei' },
      { status: 500 }
    )
  }
}
