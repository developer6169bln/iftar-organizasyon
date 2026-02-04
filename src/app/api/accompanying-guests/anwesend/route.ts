import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

/**
 * POST body: { accompanyingGuestId: string, anwesend: boolean }
 * Setzt arrivedAt für eine Begleitperson (für manuellen Check-in im Dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const accompanyingGuestId = typeof body?.accompanyingGuestId === 'string' ? body.accompanyingGuestId.trim() : ''
    const anwesend = body?.anwesend === true

    if (!accompanyingGuestId) {
      return NextResponse.json(
        { error: 'accompanyingGuestId fehlt' },
        { status: 400 }
      )
    }

    const accompanying = await prisma.accompanyingGuest.findUnique({
      where: { id: accompanyingGuestId },
      include: { invitation: { select: { eventId: true } } },
    })

    if (!accompanying) {
      return NextResponse.json({ error: 'Begleitperson nicht gefunden' }, { status: 404 })
    }

    const eventId = accompanying.invitation?.eventId
    if (!eventId) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

    const access = await requireEventAccess(request, eventId)
    if (access instanceof NextResponse) return access

    await prisma.accompanyingGuest.update({
      where: { id: accompanyingGuestId },
      data: { arrivedAt: anwesend ? new Date() : null },
    })

    return NextResponse.json({
      success: true,
      arrivedAt: anwesend ? new Date().toISOString() : null,
    })
  } catch (error) {
    console.error('Fehler beim Setzen Anwesend (Begleitperson):', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern' },
      { status: 500 }
    )
  }
}
