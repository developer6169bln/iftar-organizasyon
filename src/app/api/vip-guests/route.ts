import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Hole Event direkt aus der Datenbank
    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    })
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }
    
    const eventId = event.id

    // Hole alle Gäste
    const allGuests = await prisma.guest.findMany({
      where: { eventId },
    })

    // Filtere VIP-Gäste: isVip === true ODER VIP in additionalData === true
    const vipGuests = allGuests.filter(guest => {
      if (guest.isVip) return true
      
      // Prüfe additionalData für VIP-Feld
      if (guest.additionalData) {
        try {
          const additional = JSON.parse(guest.additionalData)
          // Prüfe verschiedene mögliche Feldnamen
          if (additional.VIP === true || additional.VIP === 'true' || 
              additional['VIP'] === true || additional['VIP'] === 'true' ||
              additional.vip === true || additional.vip === 'true') {
            return true
          }
        } catch (e) {
          // Ignoriere Parse-Fehler
        }
      }
      
      return false
    })

    return NextResponse.json(vipGuests)
  } catch (error) {
    console.error('Fehler beim Laden der VIP-Gäste:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der VIP-Gäste' },
      { status: 500 }
    )
  }
}
