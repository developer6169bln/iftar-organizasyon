import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

/**
 * POST – Tischnummern tauschen: Alle Gäste an Tisch A bekommen Tischnummer B, alle an Tisch B bekommen Tischnummer A.
 * Body: { eventId: string, tableA: number, tableB: number }
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body?.eventId as string
    const tableA = typeof body?.tableA === 'number' ? body.tableA : parseInt(String(body?.tableA ?? ''), 10)
    const tableB = typeof body?.tableB === 'number' ? body.tableB : parseInt(String(body?.tableB ?? ''), 10)

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }
    if (!Number.isInteger(tableA) || tableA < 1) {
      return NextResponse.json({ error: 'tableA muss eine positive ganze Zahl sein' }, { status: 400 })
    }
    if (!Number.isInteger(tableB) || tableB < 1) {
      return NextResponse.json({ error: 'tableB muss eine positive ganze Zahl sein' }, { status: 400 })
    }
    if (tableA === tableB) {
      return NextResponse.json({ error: 'Die beiden Tischnummern müssen unterschiedlich sein' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const guestsAtA = await prisma.guest.findMany({
      where: { eventId, tableNumber: tableA },
      select: { id: true },
    })
    const guestsAtB = await prisma.guest.findMany({
      where: { eventId, tableNumber: tableB },
      select: { id: true },
    })

    const idsA = guestsAtA.map((g) => g.id)
    const idsB = guestsAtB.map((g) => g.id)

    await prisma.$transaction([
      prisma.guest.updateMany({
        where: { id: { in: idsA } },
        data: { tableNumber: tableB },
      }),
      prisma.guest.updateMany({
        where: { id: { in: idsB } },
        data: { tableNumber: tableA },
      }),
    ])

    return NextResponse.json({
      message: `Tischnummern getauscht: Tisch ${tableA} ↔ Tisch ${tableB}. ${idsA.length} Gast/Gäste nun an Tisch ${tableB}, ${idsB.length} an Tisch ${tableA}.`,
      tableA,
      tableB,
      movedToB: idsA.length,
      movedToA: idsB.length,
    })
  } catch (error) {
    console.error('swap-table-numbers error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Tausch fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
