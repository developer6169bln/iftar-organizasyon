import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

function generateCheckInToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * POST – Zusage im Namen des Gastes durchführen (Admin).
 * Erstellt QR-Code (checkInToken) und setzt response auf ACCEPTED.
 * Für PENDING-Einladungen, damit Admin QR-Code per WhatsApp senden kann.
 */
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
      include: { guest: true, event: true },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    if (invitation.response !== 'PENDING') {
      return NextResponse.json(
        { error: 'Einladung ist bereits zugesagt oder abgesagt' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, invitation.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const mainGuestCheckInToken = generateCheckInToken()

    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        response: 'ACCEPTED',
        respondedAt: new Date(),
        accompanyingGuestsCount: 1,
      },
    })

    const guest = invitation.guest
    if (guest) {
      try {
        const additionalData = guest.additionalData ? JSON.parse(guest.additionalData) : {}
        additionalData['Zusage'] = true
        additionalData['Zusage Datum'] = new Date().toISOString()
        additionalData['Absage'] = false
        additionalData['Mitkommende Gäste'] = 1

        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CONFIRMED',
            additionalData: JSON.stringify(additionalData),
            checkInToken: mainGuestCheckInToken,
          },
        })
      } catch (e) {
        console.error('Fehler beim Aktualisieren von additionalData:', e)
        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: { status: 'CONFIRMED', checkInToken: mainGuestCheckInToken },
        })
      }
    }

    try {
      const [totalZusagen, totalAbsagen] = await Promise.all([
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'ACCEPTED' } }),
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'DECLINED' } }),
      ])
      const guestName = invitation.guest?.name ?? 'Ein Gast'
      await sendPushNotificationFromServer({
        title: 'Neue Zusage',
        body: `${guestName} hat zugesagt. Gesamt: ${totalZusagen} Zusagen, ${totalAbsagen} Absagen.`,
        url: '/dashboard/invitations',
        tag: 'invitation-accepted',
      }).catch(() => {})
    } catch {
      // Push nicht blockieren
    }

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
    console.error('Fehler bei accept-on-behalf:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler bei der Zusage' },
      { status: 500 }
    )
  }
}
