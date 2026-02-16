import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET – Liefert checkInTokens und eventTitle für eine bereits akzeptierte Einladung.
 * Wird von der Fatihgruppe-Erfolgsseite verwendet, um QR-Codes anzuzeigen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { acceptToken: token },
      include: {
        guest: { select: { name: true, checkInToken: true } },
        event: { select: { id: true, title: true } },
        accompanyingGuests: { select: { firstName: true, lastName: true, checkInToken: true } },
      },
    })

    if (!invitation || invitation.response !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden oder noch nicht zugesagt' },
        { status: 404 }
      )
    }

    const checkInTokens: Array<{ label: string; token: string; type: 'main' | 'accompanying' }> = []

    if (invitation.guest?.checkInToken) {
      checkInTokens.push({
        label: invitation.guest.name ?? 'Hauptgast',
        token: invitation.guest.checkInToken,
        type: 'main',
      })
    }

    for (const ag of invitation.accompanyingGuests ?? []) {
      const label = [ag.firstName, ag.lastName].filter(Boolean).join(' ') || 'Begleitperson'
      checkInTokens.push({
        label,
        token: ag.checkInToken,
        type: 'accompanying',
      })
    }

    return NextResponse.json({
      checkInTokens,
      eventTitle: invitation.event?.title ?? '',
      eventId: invitation.event?.id ?? '',
    })
  } catch (error) {
    console.error('Fehler beim Abrufen der Check-in-Tokens:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden' },
      { status: 500 }
    )
  }
}
