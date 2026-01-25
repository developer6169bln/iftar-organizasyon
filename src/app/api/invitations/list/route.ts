import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const response = searchParams.get('response') // ACCEPTED, DECLINED, PENDING

    const where: any = {}
    if (eventId) {
      where.eventId = eventId
    }
    if (response) {
      where.response = response
    }

    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            language: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Fehler beim Abrufen der Einladungen:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Einladungen' },
      { status: 500 }
    )
  }
}
