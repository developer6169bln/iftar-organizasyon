import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Finde Einladung
    const invitation = await prisma.invitation.findUnique({
      where: { declineToken: token },
      include: {
        guest: true,
        event: true,
      },
    })

    // Basis-URL aus Umgebung (NEXT_PUBLIC_BASE_URL etc.), nicht aus request.url – sonst landet Redirect auf localhost
    const baseUrl = getBaseUrlForInvitationEmails(request)

    if (!invitation) {
      return NextResponse.redirect(`${baseUrl}/invitation/error?message=Einladung+nicht+gefunden`)
    }

    // Prüfe ob bereits geantwortet
    if (invitation.response === 'DECLINED') {
      return NextResponse.redirect(`${baseUrl}/invitation/success?type=declined&already=true`)
    }

    // Aktualisiere Einladung
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        response: 'DECLINED',
        respondedAt: new Date(),
      },
    })

    // Aktualisiere Gast-Status und additionalData
    const guest = await prisma.guest.findUnique({
      where: { id: invitation.guestId },
    })

    if (guest) {
      try {
        const additionalData = guest.additionalData ? JSON.parse(guest.additionalData) : {}
        additionalData['Absage'] = true
        additionalData['Absage Datum'] = new Date().toISOString()
        // Setze "Zusage" auf false, wenn Absage aktiviert wird
        additionalData['Zusage'] = false

        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CANCELLED',
            additionalData: JSON.stringify(additionalData),
          },
        })
      } catch (e) {
        console.error('Fehler beim Aktualisieren von additionalData:', e)
        // Fallback: Nur Status aktualisieren
        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CANCELLED',
          },
        })
      }
    }

    // Push-Benachrichtigung an alle Abonnenten (wie Check-in): Absage mit Gesamtanzahl
    try {
      const [totalZusagen, totalAbsagen] = await Promise.all([
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'ACCEPTED' } }),
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'DECLINED' } }),
      ])
      const guestName = invitation.guest?.name ?? 'Ein Gast'
      await sendPushNotificationFromServer({
        title: 'Neue Absage',
        body: `${guestName} hat abgesagt. Gesamt: ${totalZusagen} Zusagen, ${totalAbsagen} Absagen.`,
        url: '/dashboard/invitations',
        tag: 'invitation-declined',
      }).catch((e) => {
        console.error('Push-Benachrichtigung bei Absage fehlgeschlagen:', e)
      })
    } catch (e) {
      console.error('Push-Benachrichtigung bei Absage fehlgeschlagen:', e)
    }

    // Weiterleitung zur Bestätigungsseite (konfigurierte App-URL, nie localhost in Produktion)
    return NextResponse.redirect(`${baseUrl}/invitation/success?type=declined`)
  } catch (error) {
    console.error('Fehler bei Absage:', error)
    const baseUrl = getBaseUrlForInvitationEmails(request)
    return NextResponse.redirect(`${baseUrl}/invitation/error?message=Fehler+bei+der+Verarbeitung`)
  }
}
