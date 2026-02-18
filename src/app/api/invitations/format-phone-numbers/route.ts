import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

function formatToInternational(number: string | null | undefined): string | null {
  if (!number || typeof number !== 'string') return null
  const raw = (number as string).replace(/[^\d+]/g, '')

  if (raw.startsWith('+49')) return number
  if (raw.startsWith('0049')) return '+49' + raw.slice(4)

  const festnetzVorwahlen = ['030', '040', '089', '0221']
  for (const vw of festnetzVorwahlen) {
    if (raw.startsWith(vw)) return number
  }

  if (raw.startsWith('0')) return '+49' + raw.slice(1)
  return '+49' + raw
}

/**
 * POST – Massenkorrektur der Telefonnummern (Gäste + Anmeldungen).
 * Body: { eventId?: string } – wenn eventId, nur Gäste dieses Events; sonst alle.
 * EventRegistration: immer alle (unabhängig von eventId).
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body?.eventId as string | undefined

    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }

    let updatedGuests = 0
    let updatedRegistrations = 0

    // Gäste: nur des Events, wenn eventId angegeben
    const guestWhere = eventId ? { eventId, phone: { not: null } } : { phone: { not: null } }
    const guests = await prisma.guest.findMany({
      where: guestWhere,
      select: { id: true, name: true, phone: true },
    })

    for (const guest of guests) {
      const formatted = formatToInternational(guest.phone)
      if (formatted !== guest.phone) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { phone: formatted },
        })
        updatedGuests++
      }
    }

    // EventRegistration: alle mit Telefonnummer
    const registrations = await prisma.eventRegistration.findMany({
      where: { phone: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    for (const reg of registrations) {
      const formatted = formatToInternational(reg.phone)
      if (formatted !== reg.phone) {
        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: { phone: formatted },
        })
        updatedRegistrations++
      }
    }

    return NextResponse.json({
      success: true,
      updatedGuests,
      updatedRegistrations,
      message: `${updatedGuests} Gäst(e) und ${updatedRegistrations} Anmeldung(en) korrigiert.`,
    })
  } catch (error) {
    console.error('Fehler bei format-phone-numbers:', error)
    return NextResponse.json(
      { error: 'Fehler bei der Telefonnummern-Korrektur' },
      { status: 500 }
    )
  }
}
