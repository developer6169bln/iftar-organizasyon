import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { logUpdate, getUserIdFromRequest } from '@/lib/auditLog'

const ALL_SLUGS = [
  'uid-iftar',
  'sube-baskanlari',
  'kadin-kollari',
  'genclik-kollari',
  'fatihgruppe',
  'omerliste',
  'kemalettingruppe',
]

function normalizeName(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function buildNameVariants(firstName: string, lastName: string): string[] {
  const f = (firstName || '').trim()
  const l = (lastName || '').trim()
  const variants: string[] = []
  if (f || l) {
    variants.push(normalizeName(`${f} ${l}`))
    if (f && l) variants.push(normalizeName(`${l} ${f}`))
  }
  return variants
}

/**
 * POST – Abgleich: Formular-Ergebnisse (mit Teilnahme bestätigt) → Einladungsliste als Zusage markieren.
 * Body: { eventId: string }
 * Findet Gäste, deren Name in EventRegistration mit participating=true vorkommt,
 * und setzt deren Einladung auf response=ACCEPTED, falls sie noch PENDING/ausstehend sind.
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId ist erforderlich' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventSlug: { in: ALL_SLUGS },
        participating: true,
      },
    })

    const participatingNames = new Set<string>()
    for (const r of registrations) {
      for (const v of buildNameVariants(r.firstName, r.lastName)) {
        if (v) participatingNames.add(v)
      }
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        eventId,
        OR: [{ response: null }, { response: 'PENDING' }],
      },
      include: { guest: true },
    })

    const userInfo = await getUserIdFromRequest(request)
    let updated = 0

    for (const inv of invitations) {
      const guest = inv.guest
      if (!guest) continue

      const guestNameVariants: string[] = []
      if (guest.name) guestNameVariants.push(normalizeName(guest.name))
      if (guest.additionalData) {
        try {
          const ad = typeof guest.additionalData === 'string'
            ? JSON.parse(guest.additionalData) as Record<string, unknown>
            : guest.additionalData as Record<string, unknown>
          const vorname = String(ad['Vorname'] ?? ad['vorname'] ?? '').trim()
          const nachname = String(ad['Nachname'] ?? ad['nachname'] ?? ad['Name'] ?? '').trim()
          if (vorname || nachname) {
            guestNameVariants.push(normalizeName(`${vorname} ${nachname}`))
            if (vorname && nachname) guestNameVariants.push(normalizeName(`${nachname} ${vorname}`))
          }
        } catch {
          /* ignore */
        }
      }
      const hasMatch = guestNameVariants.some((v) => v && participatingNames.has(v))
      if (!hasMatch) continue

      const oldInv = { ...inv, response: inv.response }
      await prisma.invitation.update({
        where: { id: inv.id },
        data: {
          response: 'ACCEPTED',
          respondedAt: new Date(),
        },
      })

      await logUpdate('INVITATION', inv.id, oldInv, { ...oldInv, response: 'ACCEPTED' }, request, {
        userId: userInfo.userId,
        userEmail: userInfo.userEmail,
        eventId,
        description: `Einladung für "${guest.name}" als Zusage markiert (Abgleich mit Formular-Ergebnissen)`,
      }).catch(() => {})

      updated++
    }

    return NextResponse.json({
      updated,
      totalPending: invitations.length,
      participatingNamesCount: participatingNames.size,
    })
  } catch (error) {
    console.error('Fehler beim Abgleich mit Formular-Ergebnissen:', error)
    return NextResponse.json(
      { error: 'Abgleich fehlgeschlagen' },
      { status: 500 }
    )
  }
}
