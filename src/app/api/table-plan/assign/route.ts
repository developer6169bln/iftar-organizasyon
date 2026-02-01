import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, tableNumber, guestIds, assignments } = body

    if (!eventId || tableNumber == null) {
      return NextResponse.json(
        { error: 'eventId und tableNumber erforderlich' },
        { status: 400 }
      )
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const num = typeof tableNumber === 'string' ? parseInt(tableNumber, 10) : tableNumber
    if (Number.isNaN(num)) {
      return NextResponse.json(
        { error: 'tableNumber muss eine Zahl sein' },
        { status: 400 }
      )
    }

    // Pro-Stuhl-Zuweisung: assignments = [{ seatIndex: 0, guestId: '...' | null }, ...]
    if (Array.isArray(assignments)) {
      // Zuerst: alle Gäste an diesem Tisch zurücksetzen
      const previouslyAssigned = await prisma.guest.findMany({
        where: { eventId, tableNumber: num },
      })
      for (const g of previouslyAssigned) {
        const additional = g.additionalData
          ? (JSON.parse(g.additionalData) as Record<string, unknown>)
          : {}
        delete additional['Tisch-Nummer']
        delete additional['Sitzplatz']
        const newAdditional =
          Object.keys(additional).length === 0 ? null : JSON.stringify(additional)
        await prisma.guest.update({
          where: { id: g.id },
          data: { tableNumber: null, additionalData: newAdditional },
        })
      }

      const updated: string[] = []
      for (const { seatIndex, guestId } of assignments) {
        const idx = typeof seatIndex === 'number' ? seatIndex : parseInt(String(seatIndex), 10)
        if (Number.isNaN(idx) || idx < 0) continue
        if (!guestId) continue

        const guest = await prisma.guest.findFirst({
          where: { id: guestId, eventId },
        })
        if (!guest) continue

        const additional = guest.additionalData
          ? (JSON.parse(guest.additionalData) as Record<string, unknown>)
          : {}
        additional['Tisch-Nummer'] = String(num)
        additional['Sitzplatz'] = idx + 1 // 1-basiert
        await prisma.guest.update({
          where: { id: guestId },
          data: {
            tableNumber: num,
            additionalData: JSON.stringify(additional),
          },
        })
        updated.push(guestId)
      }
      return NextResponse.json({ success: true, updated: updated.length, guestIds: updated })
    }

    // Legacy: guestIds als Array (nur Tisch, kein Sitzplatz)
    if (!Array.isArray(guestIds)) {
      return NextResponse.json(
        { error: 'guestIds (Array) oder assignments (Array) erforderlich' },
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
