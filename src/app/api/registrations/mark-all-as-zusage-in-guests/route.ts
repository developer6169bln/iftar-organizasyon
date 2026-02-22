import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
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
 * POST – Alle Einträge aus den Ergebnissen der Anmeldung in der Gästeliste als Zusage/Nimmt teil und Einladungsliste markieren.
 * Body: { eventId: string }
 * Findet für jede EventRegistration den passenden Gast (Name-Abgleich) und setzt:
 * - Guest.additionalData: Zusage=true, "Nimmt teil"=true, Absage=false, Einladungsliste=true
 * - Invitation.response=ACCEPTED (falls Einladung existiert); sonst wird eine Einladung angelegt
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

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

    let template = await prisma.emailTemplate.findFirst({
      where: { language: 'de', category: '', isDefault: true },
    })
    if (!template) {
      template = await prisma.emailTemplate.findFirst({
        where: { language: 'de', category: '' },
      })
    }
    if (!template) {
      template = await prisma.emailTemplate.create({
        data: {
          name: 'Standard Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: '<p>Liebe/r {{GUEST_NAME}},</p><p>wir laden Sie herzlich ein.</p>',
          plainText: 'Liebe/r {{GUEST_NAME}},\n\nwir laden Sie herzlich ein.',
          isDefault: true,
        },
      })
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventSlug: { in: ALL_SLUGS } },
    })

    const regNameVariants = new Map<string, string[]>()
    for (const r of registrations) {
      const variants = buildNameVariants(r.firstName, r.lastName)
      for (const v of variants) {
        if (v) regNameVariants.set(v, variants)
      }
    }

    const guests = await prisma.guest.findMany({
      where: { eventId },
      include: { invitations: { where: { eventId }, take: 1 } },
    })

    let guestsUpdated = 0
    let invitationsUpdated = 0
    let invitationsCreated = 0

    for (const guest of guests) {
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

      const isInRegistrations = nameVariants.some((v) => v && regNameVariants.has(v))
      if (!isInRegistrations) continue

      const currentAdd: Record<string, unknown> = guest.additionalData
        ? (typeof guest.additionalData === 'string'
            ? JSON.parse(guest.additionalData)
            : guest.additionalData) as Record<string, unknown>
        : {}
      const updatedAdd = {
        ...currentAdd,
        Zusage: true,
        'Nimmt teil': true,
        Absage: false,
        Einladungsliste: true,
      }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { additionalData: JSON.stringify(updatedAdd) },
      })
      guestsUpdated++

      const inv = guest.invitations?.[0]
      if (inv) {
        if (inv.response !== 'ACCEPTED') {
          await prisma.invitation.update({
            where: { id: inv.id },
            data: { response: 'ACCEPTED', respondedAt: new Date() },
          })
          invitationsUpdated++
        }
      } else {
        const acceptToken = crypto.randomBytes(32).toString('hex')
        const declineToken = crypto.randomBytes(32).toString('hex')
        const trackingToken = crypto.randomBytes(32).toString('hex')
        await prisma.invitation.create({
          data: {
            guestId: guest.id,
            eventId,
            templateId: template.id,
            language: template.language,
            subject: template.subject,
            body: template.body,
            acceptToken,
            declineToken,
            trackingToken,
            response: 'ACCEPTED',
            respondedAt: new Date(),
          },
        })
        invitationsCreated++
      }
    }

    const parts: string[] = [
      `${guestsUpdated} Gast/Gäste als Zusage/Nimmt teil und Einladungsliste markiert`,
    ]
    if (invitationsUpdated > 0) parts.push(`${invitationsUpdated} Einladung(en) als Zusage gesetzt`)
    if (invitationsCreated > 0) parts.push(`${invitationsCreated} Einladung(en) neu angelegt`)

    return NextResponse.json({
      message: parts.join('; ') + '.',
      guestsUpdated,
      invitationsUpdated,
      invitationsCreated,
    })
  } catch (error) {
    console.error('mark-all-as-zusage-in-guests error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Markierung fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
