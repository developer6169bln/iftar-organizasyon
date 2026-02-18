import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Öffentliche Infos für die Zusage-Seite (ohne Auth): Gastname, Eventtitel, max. mitkommende Gäste. */
export async function GET(
  _request: NextRequest,
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
        guest: { select: { name: true } },
        event: { select: { title: true, maxAccompanyingGuests: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    const alreadyAccepted = invitation.response === 'ACCEPTED'
    const alreadyDeclined = invitation.response === 'DECLINED'
    const maxAccompanyingGuests = invitation.event?.maxAccompanyingGuests ?? 5

    return NextResponse.json({
      guestName: invitation.guest?.name ?? '',
      eventTitle: invitation.event?.title ?? '',
      maxAccompanyingGuests,
      alreadyAccepted,
      alreadyDeclined,
    })
  } catch (error) {
    console.error('Fehler bei public-info:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einladungsinformationen' },
      { status: 500 }
    )
  }
}
