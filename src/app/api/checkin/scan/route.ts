import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

/**
 * Check-in per QR-Code: Token kann zu einem Hauptgast (Guest) oder einer Begleitperson (AccompanyingGuest) gehören.
 * POST body: { token: string }
 * Markiert den Gast/Begleitperson als anwesend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token =
      typeof body?.token === 'string' ? body.token.trim() : (request.nextUrl.searchParams.get('t') ?? '').trim()

    if (!token) {
      return NextResponse.json(
        { error: 'Token fehlt', success: false },
        { status: 400 }
      )
    }

    const guest = await prisma.guest.findUnique({
      where: { checkInToken: token },
      include: { event: { select: { title: true } } },
    })

    if (guest) {
      const additional = guest.additionalData
        ? (JSON.parse(guest.additionalData) as Record<string, unknown>)
        : {}
      additional['Anwesend'] = true
      additional['Anwesend Datum'] = new Date().toISOString()

      await prisma.guest.update({
        where: { id: guest.id },
        data: { additionalData: JSON.stringify(additional) },
      })

      await sendPushNotificationFromServer({
        title: 'Gast angekommen',
        body: `${guest.name} ist anwesend.`,
        url: '/dashboard/checkin',
        tag: 'anwesend',
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        type: 'guest',
        name: guest.name,
        eventTitle: guest.event?.title ?? '',
      })
    }

    const accompanying = await prisma.accompanyingGuest.findUnique({
      where: { checkInToken: token },
      include: { invitation: { include: { event: { select: { title: true } } } } },
    })

    if (accompanying) {
      await prisma.accompanyingGuest.update({
        where: { id: accompanying.id },
        data: { arrivedAt: new Date() },
      })

      const name = `${accompanying.firstName} ${accompanying.lastName}`.trim() || 'Begleitperson'
      await sendPushNotificationFromServer({
        title: 'Gast angekommen',
        body: `${name} ist anwesend.`,
        url: '/dashboard/checkin',
        tag: 'anwesend',
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        type: 'accompanying',
        name,
        eventTitle: accompanying.invitation?.event?.title ?? '',
      })
    }

    return NextResponse.json(
      { error: 'Ungültiger oder abgelaufener Check-in-Code', success: false },
      { status: 404 }
    )
  } catch (error) {
    console.error('Fehler beim Check-in-Scan:', error)
    return NextResponse.json(
      { error: 'Fehler bei der Verarbeitung', success: false },
      { status: 500 }
    )
  }
}
