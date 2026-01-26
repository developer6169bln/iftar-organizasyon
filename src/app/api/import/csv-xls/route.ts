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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = (formData.get('eventId') as string) || ''

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

    // Import: lösche alte Gästeliste (nur für dieses Event) und schreibe neu
    const created = await prisma.$transaction(async (tx) => {
      // Einladungen zuerst löschen (FK auf guests)
      await tx.invitation.deleteMany({ where: { eventId } })
      await tx.guest.deleteMany({ where: { eventId } })

      // Chunked createMany, damit Serverless nicht platzt
      const batchSize = 500
      let totalCreated = 0

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const data = batch.map((row) => {
          // Felder, die beim Import ignoriert werden sollen (nicht in additionalData speichern)
          // Case-insensitive Vergleich mit allen möglichen Varianten
          const shouldIgnoreField = (key: string): boolean => {
            const normalized = key.toLowerCase().trim()
            // Prüfe auf exakte Übereinstimmungen (case-insensitive)
            if (
              normalized === 'auswahl' ||
              normalized === 'einladung e-mail' ||
              normalized === 'einladung e-mail' ||
              normalized === 'einladung post' ||
              normalized === 'einladungspost' ||
              normalized === 'einladungspost' ||
              normalized === 'einladung e mail' ||
              normalized === 'einladungspost'
            ) {
              return true
            }
            // Prüfe auf Teilstrings (z.B. "Einladung E-Mail" enthält "einladung")
            if (
              normalized.includes('auswahl') ||
              (normalized.includes('einladung') && (normalized.includes('e-mail') || normalized.includes('email'))) ||
              (normalized.includes('einladung') && normalized.includes('post'))
            ) {
              return true
            }
            return false
          }

          // additionalData 1:1 wie Datei, aber ignoriere bestimmte Felder
          const additionalData: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) {
            const key = normalizeKey(k)
            if (!key) continue
            // Ignoriere Felder, die nicht importiert werden sollen (case-insensitive)
            if (shouldIgnoreField(key)) continue
            additionalData[key] = v
          }

          const vorname = firstNonEmpty(row, ['Vorname', 'vorname'])
          const nachname = firstNonEmpty(row, ['Nachname', 'nachname'])
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
            firstNonEmpty(row, ['Telefon', 'telefon', 'Mobil', 'mobil', 'phone']) ||
            null

          const isVip = truthy(
            (row as any)['VIP'] ?? (row as any)['vip'] ?? (row as any)['IsVip'] ?? (row as any)['isVip']
          )

          return {
            eventId,
            name,
            email,
            phone,
            isVip,
            status: 'INVITED',
            additionalData: JSON.stringify(additionalData),
          }
        })

        const res = await tx.guest.createMany({ data })
        totalCreated += res.count
      }

      return totalCreated
    })

    return NextResponse.json({
      success: true,
      message: `${created} Gäste erfolgreich importiert`,
      imported: created,
      total: rows.length,
      headers,
    })
  } catch (error: any) {
    console.error('Import-Fehler:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Importieren der Datei' },
      { status: 500 }
    )
  }
}
