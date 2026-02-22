import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnyPageAccess, requireEventAccess } from '@/lib/permissions'

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
 * POST – Zusagen/Absagen aus der Einladungsliste in die Ergebnisse der Anmeldung zurückspielen.
 * Body: { eventId: string }
 * Findet für jede Einladung mit response ACCEPTED/DECLINED den passenden EventRegistration (Name-Abgleich)
 * und setzt participating = true (Zusage) bzw. false (Absage).
 */
export async function POST(request: NextRequest) {
  const access = await requireAnyPageAccess(request, ['guests', 'invitations'])
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.eventId as string

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId ist erforderlich' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const invitations = await prisma.invitation.findMany({
      where: {
        eventId,
        response: { in: ['ACCEPTED', 'DECLINED'] },
      },
      include: { guest: true },
    })

    if (invitations.length === 0) {
      return NextResponse.json({
        message: 'Keine Zusagen oder Absagen in der Einladungsliste gefunden. Nichts zu übernehmen.',
        updated: 0,
      })
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventSlug: { in: ALL_SLUGS } },
    })

    const regByKey = new Map<string, (typeof registrations)[0][]>()
    for (const r of registrations) {
      for (const v of buildNameVariants(r.firstName, r.lastName)) {
        if (v) {
          const list = regByKey.get(v) ?? []
          if (!list.includes(r)) list.push(r)
          regByKey.set(v, list)
        }
      }
    }

    let updated = 0
    const updatedRegIds = new Set<string>()
    for (const inv of invitations) {
      const guest = inv.guest
      if (!guest) continue

      const nameVariants: string[] = []
      if (guest.name) nameVariants.push(normalizeName(guest.name))
      if (guest.additionalData) {
        try {
          const ad =
            typeof guest.additionalData === 'string'
              ? (JSON.parse(guest.additionalData) as Record<string, unknown>)
              : (guest.additionalData as Record<string, unknown>)
          const vorname = String(ad['Vorname'] ?? ad['vorname'] ?? '').trim()
          const nachname = String(ad['Nachname'] ?? ad['nachname'] ?? ad['Name'] ?? '').trim()
          if (vorname || nachname) {
            nameVariants.push(normalizeName(`${vorname} ${nachname}`))
            if (vorname && nachname) nameVariants.push(normalizeName(`${nachname} ${vorname}`))
          }
        } catch {
          /* ignore */
        }
      }

      const participating = inv.response === 'ACCEPTED'
      let matched = false
      for (const v of nameVariants) {
        if (!v || matched) continue
        const regs = regByKey.get(v) ?? []
        for (const reg of regs) {
          if (reg.participating !== participating && !updatedRegIds.has(reg.id)) {
            await prisma.eventRegistration.update({
              where: { id: reg.id },
              data: { participating },
            })
            updatedRegIds.add(reg.id)
            updated++
          }
        }
        if (regs.length > 0) matched = true
      }
    }

    return NextResponse.json({
      message: `${updated} Anmeldung(en) in den Ergebnissen der Anmeldung mit Zusagen/Absagen aus der Einladungsliste aktualisiert.`,
      updated,
    })
  } catch (error) {
    console.error('sync-from-invitations error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Zusagen/Absagen konnten nicht übernommen werden', details: msg },
      { status: 500 }
    )
  }
}
