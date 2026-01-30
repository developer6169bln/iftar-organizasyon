import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, tableNumber, guestIds } = body

    if (!eventId || tableNumber == null || !Array.isArray(guestIds)) {
      return NextResponse.json(
        { error: 'eventId, tableNumber (Nummer) und guestIds (Array) erforderlich' },
        { status: 400 }
      )
    }

    const num = typeof tableNumber === 'string' ? parseInt(tableNumber, 10) : tableNumber
    if (Number.isNaN(num)) {
      return NextResponse.json(
        { error: 'tableNumber muss eine Zahl sein' },
        { status: 400 }
      )
    }

    const updated: string[] = []

    for (const guestId of guestIds) {
      const guest = await prisma.guest.findFirst({
        where: { id: guestId, eventId },
      })
      if (!guest) continue

      const additional = guest.additionalData
        ? (JSON.parse(guest.additionalData) as Record<string, unknown>)
        : {}
      additional['Tisch-Nummer'] = String(num)
      if (guest.tableNumber !== num) {
        await prisma.guest.update({
          where: { id: guestId },
          data: {
            tableNumber: num,
            additionalData: JSON.stringify(additional),
          },
        })
        updated.push(guestId)
      }
    }

    return NextResponse.json({ success: true, updated: updated.length, guestIds: updated })
  } catch (error) {
    console.error('Table plan assign error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Zuweisen der Gäste zum Tisch' },
      { status: 500 }
    )
  }
}
