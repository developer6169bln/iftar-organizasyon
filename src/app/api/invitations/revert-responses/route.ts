import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

/**
 * POST – Alle Zusagen/Absagen für ein Event zurücksetzen.
 * Setzt response aller Einladungen auf PENDING, respondedAt auf null
 * und entfernt checkInToken bei Gästen (QR-Code ungültig).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.eventId

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const invitations = await prisma.invitation.findMany({
      where: { eventId },
      select: { id: true, guestId: true, response: true },
    })

    const toRevert = invitations.filter((inv) => inv.response !== null && inv.response !== 'PENDING')
    if (toRevert.length === 0) {
      return NextResponse.json({
        message: 'Keine Zusagen oder Absagen zum Zurücksetzen.',
        reverted: 0,
      })
    }

    const guestIdsToClearToken = toRevert
      .filter((inv) => inv.response === 'ACCEPTED')
      .map((inv) => inv.guestId)

    await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { eventId },
        data: { response: 'PENDING', respondedAt: null },
      })
      if (guestIdsToClearToken.length > 0) {
        await tx.guest.updateMany({
          where: { id: { in: guestIdsToClearToken } },
          data: { checkInToken: null, status: 'INVITED' },
        })
      }
    })

    return NextResponse.json({
      message: `${toRevert.length} Einladung(en) auf „Ausstehend“ zurückgesetzt. Zusagen und Absagen wurden rückgängig gemacht.`,
      reverted: toRevert.length,
    })
  } catch (error) {
    console.error('revert-responses error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Fehler beim Zurücksetzen der Zusagen/Absagen', details: msg },
      { status: 500 }
    )
  }
}
