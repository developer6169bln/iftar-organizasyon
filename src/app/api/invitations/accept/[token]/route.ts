import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    if (!invitation) {
      return NextResponse.redirect(
        new URL('/invitation/error?message=Einladung nicht gefunden', request.url)
      )
    }

    // Prüfe ob bereits geantwortet
    if (invitation.response === 'ACCEPTED') {
      return NextResponse.redirect(
        new URL('/invitation/success?type=accepted&already=true', request.url)
      )
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

    // Weiterleitung zur Bestätigungsseite
    return NextResponse.redirect(
      new URL('/invitation/success?type=accepted', request.url)
    )
  } catch (error) {
    console.error('Fehler bei Zusage:', error)
    return NextResponse.redirect(
      new URL('/invitation/error?message=Fehler bei der Verarbeitung', request.url)
    )
  }
}
