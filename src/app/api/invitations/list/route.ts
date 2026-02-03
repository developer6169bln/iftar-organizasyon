import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const response = searchParams.get('response') // ACCEPTED, DECLINED, PENDING
    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }

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
            tableNumber: true,
            isVip: true,
            organization: true,
            additionalData: true,
            notes: true,
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

    // Nur Gäste anzeigen, die in der Gästeliste im Feld additionalData "Einladungsliste" ausgewählt haben.
    // Ausgewählt: true, "true", "ja", "Ja", "yes", "1", 1. Key auch case-insensitiv (Einladungsliste / einladungsliste).
    // Wenn additionalData fehlt oder der Key fehlt: Einladung trotzdem anzeigen (Fallback, z. B. wenn PATCH nach Checkbox-Klick fehlgeschlagen ist).
    const filtered = invitations.filter((inv) => {
      const additional = inv.guest?.additionalData
      if (!additional) return true
      try {
        const data = typeof additional === 'string' ? JSON.parse(additional) : additional
        if (!data || typeof data !== 'object') return true
        const key = Object.keys(data).find((k) => k.trim().toLowerCase() === 'einladungsliste')
        const value = key ? data[key] : undefined
        if (value === undefined) return true
        if (value === true) return true
        if (value === 1) return true
        if (typeof value === 'string') {
          const s = value.trim().toLowerCase()
          if (s === 'true' || s === 'ja' || s === 'yes' || s === '1') return true
        }
        return false
      } catch {
        return true
      }
    })

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Fehler beim Abrufen der Einladungen:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Einladungen' },
      { status: 500 }
    )
  }
}
