import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

/**
 * GET ?eventId=xxx – Begleitpersonen für ein Event (für Einladungsliste und Check-in).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
    }

    const access = await requireEventAccess(request, eventId)
    if (access instanceof NextResponse) return access

    const accompanying = await prisma.accompanyingGuest.findMany({
      where: { invitation: { eventId } },
      include: {
        invitation: {
          select: {
            id: true,
            guestId: true,
            guest: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const list = accompanying.map((a) => ({
      id: a.id,
      invitationId: a.invitationId,
      firstName: a.firstName,
      lastName: a.lastName,
      funktion: a.funktion,
      email: a.email,
      arrivedAt: a.arrivedAt,
      mainGuestName: a.invitation?.guest?.name ?? '',
    }))

    return NextResponse.json(list)
  } catch (error) {
    console.error('Fehler beim Abrufen der Begleitgäste:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Begleitgäste' },
      { status: 500 }
    )
  }
}
