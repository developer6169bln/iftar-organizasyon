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
      where: { declineToken: token },
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
    if (invitation.response === 'DECLINED') {
      return NextResponse.redirect(
        new URL('/invitation/success?type=declined&already=true', request.url)
      )
    }

    // Aktualisiere Einladung
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        response: 'DECLINED',
        respondedAt: new Date(),
      },
    })

    // Aktualisiere Gast-Status
    await prisma.guest.update({
      where: { id: invitation.guestId },
      data: {
        status: 'DECLINED',
      },
    })

    // Weiterleitung zur Bestätigungsseite
    return NextResponse.redirect(
      new URL('/invitation/success?type=declined', request.url)
    )
  } catch (error) {
    console.error('Fehler bei Absage:', error)
    return NextResponse.redirect(
      new URL('/invitation/error?message=Fehler bei der Verarbeitung', request.url)
    )
  }
}
