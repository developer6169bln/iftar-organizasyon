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
    const shuffled = shuffle(withZusage)

    const totalSeats = numTables * seatsPerTable
    const toAssign = shuffled.slice(0, totalSeats)
    const assignedIds = new Set(toAssign.map((g) => g.id))
    const toUnassign = nonVip.filter((g) => !assignedIds.has(g.id))

    const updates = [
      ...toAssign.map((guest, index) => {
        const tableIndex = Math.floor(index / seatsPerTable)
        const tableNumber = tableIndex + 1
        return prisma.guest.update({
          where: { id: guest.id },
          data: { tableNumber },
        })
      }),
      ...toUnassign.map((guest) =>
        prisma.guest.update({
          where: { id: guest.id },
          data: { tableNumber: null },
        })
      ),
    ]

    await prisma.$transaction(updates)

    return NextResponse.json({
      message: 'Tischzuweisung durchgeführt',
      assigned: toAssign.length,
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
