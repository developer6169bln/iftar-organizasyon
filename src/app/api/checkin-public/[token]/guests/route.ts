import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyToken(token: string): boolean {
  const validToken = process.env.CHECKIN_PUBLIC_TOKEN || 'checkin2024'
  return token === validToken
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!verifyToken(token)) {
      return NextResponse.json({ error: 'Ungültiger Zugangscode' }, { status: 403 })
    }

    const eventIdParam = request.nextUrl.searchParams.get('eventId')

    let event: { id: string } | null
    if (eventIdParam) {
      event = await prisma.event.findUnique({
        where: { id: eventIdParam },
        select: { id: true },
      })
    } else {
      event = await prisma.event.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    }

    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

    const guests = await prisma.guest.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        name: true,
        tableNumber: true,
        isVip: true,
        organization: true,
        additionalData: true,
      },
    })

    return NextResponse.json(guests)
  } catch (error) {
    console.error('Fehler beim Laden der öffentlichen Gäste:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Daten' },
      { status: 500 }
    )
  }
}
