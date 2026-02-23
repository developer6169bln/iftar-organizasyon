import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

/**
 * POST – Setzt die Tischnummer aller Gäste eines Events auf null.
 * Body: { eventId: string }
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const eventId = body?.eventId as string

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const result = await prisma.guest.updateMany({
      where: { eventId },
      data: { tableNumber: null },
    })

    return NextResponse.json({
      message: 'Alle Tische zurückgesetzt',
      count: result.count,
    })
  } catch (error) {
    console.error('reset-tables error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Zurücksetzen fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
