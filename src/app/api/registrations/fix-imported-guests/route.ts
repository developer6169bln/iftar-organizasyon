import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { logUpdate, getUserIdFromRequest } from '@/lib/auditLog'

/**
 * POST – Bereits importierte Gäste korrigieren (Vorname/Nachname in richtige Spalten).
 * Body: { eventSlug: string, eventId: string }
 * Findet Gäste, deren Name mit Anmeldungen übereinstimmt, und setzt additionalData.Vorname/Nachname.
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const { eventSlug, eventId } = body

    if (!eventSlug || !eventId) {
      return NextResponse.json(
        { error: 'eventSlug und eventId sind erforderlich' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventSlug },
    })

    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: { id: true, name: true, additionalData: true },
    })

    const regByFullName = new Map<string, { firstName: string; lastName: string }>()
    for (const reg of registrations) {
      const fullName = [reg.firstName, reg.lastName].filter(Boolean).join(' ').trim().toLowerCase()
      if (fullName) regByFullName.set(fullName, { firstName: reg.firstName, lastName: reg.lastName })
    }

    let fixed = 0
    const userInfo = await getUserIdFromRequest(request)

    for (const guest of guests) {
      const fullName = (guest.name || '').trim()
      if (!fullName) continue

      const reg = regByFullName.get(fullName.toLowerCase())
      if (!reg) continue

      let additional: Record<string, unknown> = {}
      if (guest.additionalData) {
        try {
          additional = JSON.parse(guest.additionalData) as Record<string, unknown>
        } catch {
          additional = {}
        }
      }

      const currentVorname = String(additional['Vorname'] ?? additional['vorname'] ?? '').trim()
      const currentNachname = String(additional['Nachname'] ?? additional['nachname'] ?? '').trim()

      if (currentVorname === reg.firstName?.trim() && currentNachname === reg.lastName?.trim()) {
        continue
      }

      const updated = { ...additional, Vorname: reg.firstName?.trim() ?? '', Nachname: reg.lastName?.trim() ?? '' }
      const oldGuest = { ...guest, additionalData: guest.additionalData }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { additionalData: JSON.stringify(updated) },
      })

      const updatedGuest = { ...guest, additionalData: JSON.stringify(updated) }
      await logUpdate('GUEST', guest.id, oldGuest, updatedGuest, request, {
        userId: userInfo.userId,
        userEmail: userInfo.userEmail,
        eventId,
        description: `Gast "${fullName}" korrigiert (Vorname/Nachname aus Anmeldung)`,
      })

      fixed++
    }

    return NextResponse.json({
      fixed,
      totalGuests: guests.length,
      totalRegistrations: registrations.length,
    })
  } catch (error) {
    console.error('Fehler beim Korrigieren der importierten Gäste:', error)
    return NextResponse.json(
      { error: 'Korrektur fehlgeschlagen' },
      { status: 500 }
    )
  }
}
