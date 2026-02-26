import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

/** Spool-Tisch: Schnellanmeldungen landen direkt hier (Warteliste), von dort an Tische verschieben. */
const SPOOL_TABLE = 700

/**
 * POST – Schnellerfassung: Gast nur mit Vorname, Nachname, Staat/Institution anlegen.
 * Body: { eventId: string, firstName: string, lastName: string, staatInstitution?: string }
 * Der Gast wird sofort als Zusage/Nimmt teil markiert, in die Einladungsliste aufgenommen und dem Spool-Tisch (Warteliste) zugewiesen.
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.eventId as string
    const firstName = (body.firstName ?? '').trim()
    const lastName = (body.lastName ?? '').trim()
    const staatInstitution = (body.staatInstitution ?? body.staat_institution ?? '').trim()

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }
    if (!firstName && !lastName) {
      return NextResponse.json({ error: 'Vorname oder Nachname ist erforderlich' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unbekannt'

    const additionalData: Record<string, unknown> = {
      Vorname: firstName,
      Nachname: lastName,
      Einladungsliste: true,
      Zusage: true,
      'Nimmt teil': true,
      Absage: false,
      'Zusage Datum': new Date().toISOString(),
    }
    if (staatInstitution) {
      additionalData['Staat/Institution'] = staatInstitution
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
      template = await prisma.emailTemplate.findFirst({})
    }

    const checkInToken = crypto.randomBytes(24).toString('hex')

    const guest = await prisma.guest.create({
      data: {
        eventId,
        name: fullName,
        email: null,
        phone: null,
        organization: staatInstitution || null,
        status: 'INVITED',
        additionalData: JSON.stringify(additionalData),
        checkInToken,
        tableNumber: SPOOL_TABLE,
      },
    })

    if (template) {
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
    }

    return NextResponse.json({
      message: `${fullName} wurde erfasst, in die Einladungsliste aufgenommen (Zusage/Nimmt teil) und auf die Spool-Warteliste gesetzt. Von dort kann der Gast an einen Tisch verschoben werden.`,
      guestId: guest.id,
      fullName,
    })
  } catch (error) {
    console.error('guests/quick-add error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Schnellerfassung fehlgeschlagen', details: msg },
      { status: 500 }
    )
  }
}
