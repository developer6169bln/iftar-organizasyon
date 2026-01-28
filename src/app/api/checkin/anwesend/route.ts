import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { guestId, anwesend } = body

    if (!guestId || typeof anwesend !== 'boolean') {
      return NextResponse.json(
        { error: 'guestId und anwesend (boolean) sind erforderlich' },
        { status: 400 }
      )
    }

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    })

    if (!guest) {
      return NextResponse.json({ error: 'Gast nicht gefunden' }, { status: 404 })
    }

    const additional = guest.additionalData
      ? (JSON.parse(guest.additionalData) as Record<string, unknown>)
      : {}
    additional['Anwesend'] = anwesend
    if (anwesend) {
      additional['Anwesend Datum'] = new Date().toISOString()
    } else {
      delete additional['Anwesend Datum']
    }

    const updated = await prisma.guest.update({
      where: { id: guestId },
      data: { additionalData: JSON.stringify(additional) },
    })

    if (anwesend) {
      await sendPushNotificationFromServer({
        title: 'Gast angekommen',
        body: `${guest.name} ist anwesend.`,
        url: '/dashboard/checkin',
        tag: 'anwesend',
      }).catch((err) => {
        console.error('Push bei Anwesend-Check fehlgeschlagen:', err)
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Fehler beim Setzen Anwesend:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern' },
      { status: 500 }
    )
  }
}
