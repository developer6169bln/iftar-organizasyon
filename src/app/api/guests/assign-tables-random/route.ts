import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

function isVip(guest: { isVip: boolean | null; additionalData: string | null }): boolean {
  if (guest.isVip) return true
  if (!guest.additionalData) return false
  try {
    const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    const v = add?.VIP ?? add?.vip
    return v === true || v === 'true' || v === 1
  } catch {
    return false
  }
}

/** Prüft, ob der Gast Zusage oder „Nimmt teil“ hat (nur diese bekommen einen Tisch). */
function hasZusageOrTeilnahme(guest: { additionalData: string | null }): boolean {
  if (!guest.additionalData) return false
  try {
    const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    if (!add || typeof add !== 'object') return false
    const zusage = add['Zusage'] ?? add['zusage']
    const nimmtTeil = add['Nimmt teil'] ?? add['nimmt teil']
    const truthy = (v: unknown) =>
      v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(v.trim().toLowerCase()))
    return truthy(zusage) || truthy(nimmtTeil)
  } catch {
    return false
  }
}

/** Prüft, ob in der Gästeliste „Weiblich“ gesetzt ist (diese Gäste nur mit anderen weiblichen an einem Tisch). */
function isWeiblich(guest: { additionalData: string | null }): boolean {
  if (!guest.additionalData) return false
  try {
    const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    if (!add || typeof add !== 'object') return false
    const v = add['Weiblich'] ?? add['weiblich']
    return v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(String(v).trim().toLowerCase()))
  } catch {
    return false
  }
}

/** Tischfarbe aus additionalData („1“–„4“ oder leer). Gleiche Farbe + gleiches Geschlecht = gleicher Tischblock. */
function getTischfarbe(guest: { additionalData: string | null }): string {
  if (!guest.additionalData) return ''
  try {
    const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    if (!add || typeof add !== 'object') return ''
    const v = add['Tischfarbe'] ?? add['tischfarbe']
    const s = String(v ?? '').trim()
    return s === '1' || s === '2' || s === '3' || s === '4' ? s : ''
  } catch {
    return ''
  }
}

/** Presse-Gäste kommen immer an Tisch 1 (eigener Presse-Tisch). */
function isPresse(guest: { additionalData: string | null }): boolean {
  if (!guest.additionalData) return false
  try {
    const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    if (!add || typeof add !== 'object') return false
    const v = add['Presse'] ?? add['presse']
    return v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(String(v).trim().toLowerCase()))
  } catch {
    return false
  }
}

/** Fisher-Yates Shuffle */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * POST – Zuweisung von Gästen an Tische per Zufall.
 * Body: { eventId: string, numTables: number, seatsPerTable: number }
 * Nur Gäste mit Zusage oder „Nimmt teil“ bekommen einen Tisch. VIP-Gäste werden nicht geändert.
 * Gäste mit „Weiblich“ in der Gästeliste sitzen nur mit anderen weiblichen Gästen an einem Tisch (eigene Tischblöcke).
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const eventId = body?.eventId as string
    const numTables = typeof body?.numTables === 'number' ? body.numTables : parseInt(body?.numTables, 10)
    const seatsPerTable = typeof body?.seatsPerTable === 'number' ? body.seatsPerTable : parseInt(body?.seatsPerTable, 10)

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }
    if (!Number.isInteger(numTables) || numTables < 1) {
      return NextResponse.json({ error: 'Anzahl Tische muss eine positive Zahl sein' }, { status: 400 })
    }
    if (!Number.isInteger(seatsPerTable) || seatsPerTable < 1) {
      return NextResponse.json({ error: 'Sitzplätze pro Tisch muss eine positive Zahl sein' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: { id: true, isVip: true, additionalData: true },
    })

    const nonVip = guests.filter((g) => !isVip(g))
    const withZusage = nonVip.filter(hasZusageOrTeilnahme)
    const presse = withZusage.filter(isPresse)
    const nonPresse = withZusage.filter((g) => !isPresse(g))

    const updates: ReturnType<typeof prisma.guest.update>[] = []
    const assignedIds: string[] = []
    let tableOffset = 0

    // Immer mindestens ein Tisch für Presse (Tisch 1, ggf. mehrere wenn viele Presse-Gäste).
    if (presse.length > 0) {
      const presseShuffled = shuffle(presse)
      const presseTables = Math.ceil(presse.length / Math.max(1, seatsPerTable))
      const presseSeats = presseTables * seatsPerTable
      const toAssignPresse = presseShuffled.slice(0, presseSeats)
      for (let i = 0; i < toAssignPresse.length; i++) {
        const tableNumber = Math.floor(i / seatsPerTable) + 1
        updates.push(
          prisma.guest.update({
            where: { id: toAssignPresse[i].id },
            data: { tableNumber },
          })
        )
        assignedIds.push(toAssignPresse[i].id)
      }
      tableOffset = presseTables
    }

    // Übrige Gäste: Gruppierung nach Geschlecht + Tischfarbe (Tische ab 2).
    const FARBE_ORDER = ['', '1', '2', '3', '4'] as const
    const groups = new Map<string, typeof nonPresse>()
    for (const g of nonPresse) {
      const w = isWeiblich(g)
      const f = getTischfarbe(g)
      const key = `${w ? 'w' : 'm'}-${f || '_'}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(g)
    }

    for (const weiblich of [true, false]) {
      for (const farbe of FARBE_ORDER) {
        const key = `${weiblich ? 'w' : 'm'}-${farbe || '_'}`
        const group = groups.get(key) ?? []
        if (group.length === 0) continue
        const shuffled = shuffle(group)
        const requiredTables = Math.ceil(group.length / Math.max(1, seatsPerTable))
        const seats = requiredTables * seatsPerTable
        const toAssign = shuffled.slice(0, seats)
        for (let i = 0; i < toAssign.length; i++) {
          const tableNumber = tableOffset + Math.floor(i / seatsPerTable) + 1
          updates.push(
            prisma.guest.update({
              where: { id: toAssign[i].id },
              data: { tableNumber },
            })
          )
          assignedIds.push(toAssign[i].id)
        }
        tableOffset += requiredTables
      }
    }

    const numTablesToUse = Math.max(numTables, tableOffset)
    const assignedSet = new Set(assignedIds)
    const toUnassign = nonVip.filter((g) => !assignedSet.has(g.id))
    for (const guest of toUnassign) {
      updates.push(
        prisma.guest.update({
          where: { id: guest.id },
          data: { tableNumber: null },
        })
      )
    }

    await prisma.$transaction(updates)

    return NextResponse.json({
      message: 'Tischzuweisung durchgeführt (gruppiert nach Geschlecht + Tischfarbe)',
      assigned: assignedIds.length,
      numTablesUsed: numTablesToUse,
      tablesAutoAdjusted: numTablesToUse > numTables,
      unassigned: toUnassign.length,
      skippedVip: guests.length - nonVip.length,
      skippedNoZusage: nonVip.length - withZusage.length,
      numTables,
      seatsPerTable,
    })
  } catch (error) {
    console.error('assign-tables-random error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Tischzuweisung fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
