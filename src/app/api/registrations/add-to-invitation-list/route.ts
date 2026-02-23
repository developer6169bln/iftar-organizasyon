import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAnyPageAccess, requireEventAccess } from '@/lib/permissions'

function normalizeName(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * POST – Einen einzelnen Anmeldungs-Eintrag in die Gästeliste und Einladungsliste übernehmen.
 * Body: { registrationId: string, eventId: string }
 * Erstellt ggf. Gast, setzt Einladungsliste/Zusage/Nimmt teil, legt Einladung an, setzt invitationSentAt.
 */
export async function POST(request: NextRequest) {
  const access = await requireAnyPageAccess(request, ['guests', 'invitations'])
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json().catch(() => ({}))
    const registrationId = body.registrationId as string
    const eventId = body.eventId as string

    if (!registrationId || !eventId) {
      return NextResponse.json(
        { error: 'registrationId und eventId sind erforderlich' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    })
    if (!registration) {
      return NextResponse.json({ error: 'Anmeldung nicht gefunden' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

    const firstName = (registration.firstName ?? '').trim()
    const lastName = (registration.lastName ?? '').trim()
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unbekannt'

    const additionalData: Record<string, unknown> = {
      Vorname: firstName,
      Nachname: lastName,
      Einladungsliste: true,
      Zusage: true,
      'Nimmt teil': true,
      Absage: false,
    }
    if (registration.district) additionalData['Bezirk'] = registration.district
    if (registration.notes) additionalData['Notizen'] = registration.notes

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

    const nameNormalized = normalizeName(`${firstName} ${lastName}`)

    let guest = await prisma.guest.findFirst({
      where: {
        eventId,
        OR: [
          ...(registration.email ? [{ email: registration.email }] : []),
          { name: { equals: fullName, mode: 'insensitive' } },
        ],
      },
      include: { invitations: { where: { eventId }, take: 1 } },
    })

    if (!guest && nameNormalized) {
      const guests = await prisma.guest.findMany({
        where: { eventId },
        include: { invitations: { where: { eventId }, take: 1 } },
      })
      for (const g of guests) {
        const gName = (g.name ?? '').trim().toLowerCase()
        const add = g.additionalData
          ? (typeof g.additionalData === 'string' ? JSON.parse(g.additionalData) : g.additionalData) as Record<string, unknown>
          : {}
        const v = String(add['Vorname'] ?? add['vorname'] ?? '').trim()
        const n = String(add['Nachname'] ?? add['nachname'] ?? '').trim()
        const combined = normalizeName(`${v || gName.split(' ')[0]} ${n || gName.split(' ').slice(1).join(' ')}`)
        if (combined === nameNormalized || gName === nameNormalized) {
          guest = g
          break
        }
      }
    }

    const newCheckInToken = crypto.randomBytes(24).toString('hex')
    let guestId: string
    if (!guest) {
      const created = await prisma.guest.create({
        data: {
          eventId,
          name: fullName,
          email: registration.email || null,
          phone: registration.phone || null,
          notes: registration.notes || null,
          organization: registration.district || null,
          status: 'INVITED',
          additionalData: JSON.stringify(additionalData),
          checkInToken: newCheckInToken,
        },
      })
      guestId = created.id
    } else {
      guestId = guest.id
      const currentAdd: Record<string, unknown> = guest.additionalData
        ? (typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData) as Record<string, unknown>
        : {}
      const updatedAdd = { ...currentAdd, ...additionalData }
      await prisma.guest.update({
        where: { id: guest.id },
        data: {
          additionalData: JSON.stringify(updatedAdd),
          ...(guest.checkInToken ? {} : { checkInToken: newCheckInToken }),
        },
      })
    }

    const existingInv = await prisma.invitation.findFirst({
      where: { guestId, eventId },
    })

    if (!existingInv) {
      const acceptToken = crypto.randomBytes(32).toString('hex')
      const declineToken = crypto.randomBytes(32).toString('hex')
      const trackingToken = crypto.randomBytes(32).toString('hex')
      await prisma.invitation.create({
        data: {
          guestId,
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
    } else if (existingInv.response !== 'ACCEPTED') {
      await prisma.invitation.update({
        where: { id: existingInv.id },
        data: { response: 'ACCEPTED', respondedAt: new Date() },
      })
    }

    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { invitationSentAt: new Date() },
    })

    return NextResponse.json({
      message: `${fullName} wurde in die Gästeliste und Einladungsliste übernommen.`,
      fullName,
    })
  } catch (error) {
    console.error('add-to-invitation-list error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Übernahme in Einladungsliste fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
