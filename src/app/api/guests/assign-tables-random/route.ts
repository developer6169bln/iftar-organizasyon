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
 * VIP-Gäste werden nicht zugewiesen (tableNumber bleibt unverändert).
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
    const shuffled = shuffle(nonVip)

    const totalSeats = numTables * seatsPerTable
    const toAssign = shuffled.slice(0, totalSeats)

    await prisma.$transaction(
      toAssign.map((guest, index) => {
        const tableIndex = Math.floor(index / seatsPerTable)
        const tableNumber = tableIndex + 1
        return prisma.guest.update({
          where: { id: guest.id },
          data: { tableNumber },
        })
      })
    )

    return NextResponse.json({
      message: 'Tischzuweisung durchgeführt',
      assigned: toAssign.length,
      skippedVip: guests.length - nonVip.length,
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
