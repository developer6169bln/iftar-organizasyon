import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'

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

    // Weiterleitung zur Bestätigungsseite (konfigurierte App-URL, nie localhost in Produktion)
    return NextResponse.redirect(`${baseUrl}/invitation/success?type=declined`)
  } catch (error) {
    console.error('Fehler bei Absage:', error)
    const baseUrl = getBaseUrlForInvitationEmails(request)
    return NextResponse.redirect(`${baseUrl}/invitation/error?message=Fehler+bei+der+Verarbeitung`)
  }
}
