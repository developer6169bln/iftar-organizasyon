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
      where: { acceptToken: token },
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
    if (invitation.response === 'ACCEPTED') {
      return NextResponse.redirect(`${baseUrl}/invitation/success?type=accepted&already=true`)
    }

    if (invitation.response === 'DECLINED') {
      // Erlaube Änderung von Absage zu Zusage
    }

    // Aktualisiere Einladung
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        response: 'ACCEPTED',
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
        additionalData['Zusage'] = true
        additionalData['Zusage Datum'] = new Date().toISOString()
        // Setze "Absage" auf false, wenn Zusage aktiviert wird
        additionalData['Absage'] = false

        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CONFIRMED',
            additionalData: JSON.stringify(additionalData),
          },
        })
      } catch (e) {
        console.error('Fehler beim Aktualisieren von additionalData:', e)
        // Fallback: Nur Status aktualisieren
        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CONFIRMED',
          },
        })
      }
    }

    // Weiterleitung zur Bestätigungsseite (konfigurierte App-URL, nie localhost in Produktion)
    return NextResponse.redirect(`${baseUrl}/invitation/success?type=accepted`)
  } catch (error) {
    console.error('Fehler bei Zusage:', error)
    const baseUrl = getBaseUrlForInvitationEmails(request)
    return NextResponse.redirect(`${baseUrl}/invitation/error?message=Fehler+bei+der+Verarbeitung`)
  }
}
