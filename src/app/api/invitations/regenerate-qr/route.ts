import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const { invitationId } = body

    if (!invitationId) {
      return NextResponse.json({ error: 'invitationId ist erforderlich' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        guest: { select: { id: true } },
        accompanyingGuests: { select: { id: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    const eventAccess = await requireEventAccess(request, invitation.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const newAcceptToken = crypto.randomBytes(32).toString('hex')
    const newDeclineToken = crypto.randomBytes(32).toString('hex')
    const newTrackingToken = crypto.randomBytes(32).toString('hex')
    const newGuestCheckInToken = crypto.randomBytes(24).toString('hex')

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitationId },
        data: {
          acceptToken: newAcceptToken,
          declineToken: newDeclineToken,
          trackingToken: newTrackingToken,
        },
      })

      await tx.guest.update({
        where: { id: invitation.guestId },
        data: { checkInToken: newGuestCheckInToken },
      })

      for (const ag of invitation.accompanyingGuests) {
        await tx.accompanyingGuest.update({
          where: { id: ag.id },
          data: { checkInToken: crypto.randomBytes(24).toString('hex') },
        })
      }
    })

    const updated = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        guest: true,
        event: true,
        template: true,
        accompanyingGuests: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Fehler beim Regenerieren des QR-Codes:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Regenerieren des QR-Codes' },
      { status: 500 }
    )
  }
}
