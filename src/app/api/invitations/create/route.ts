import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access
  try {
    const { guestId, eventId, skipEmail } = await request.json()

    if (!guestId || !eventId) {
      return NextResponse.json(
        { error: 'guestId und eventId sind erforderlich' },
        { status: 400 }
      )
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    // Prüfe ob Gast existiert
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    })

    if (!guest) {
      return NextResponse.json(
        { error: 'Gast nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe ob Event existiert
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe ob bereits eine Einladung existiert
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        guestId,
        eventId,
      },
    })

    if (existingInvitation) {
      // Einladung existiert bereits, gib sie zurück
      return NextResponse.json(existingInvitation)
    }

    // Hole Standard-Template (deutsch, global) oder erstelle eines, falls nicht vorhanden
    let template = await prisma.emailTemplate.findFirst({
      where: {
        language: 'de',
        category: '',
        isDefault: true,
      },
    })

    if (!template) {
      // Fallback: beliebiges deutsches Global-Template
      template = await prisma.emailTemplate.findFirst({
        where: { language: 'de', category: '' },
      })
    }

    if (!template) {
      // Erstelle Standard-Template falls keines vorhanden
      template = await prisma.emailTemplate.create({
        data: {
          name: 'Standard Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: `<p>Liebe/r {{GUEST_NAME}},</p>
<p>wir laden Sie herzlich ein zum Iftar-Essen am {{EVENT_DATE}} um {{EVENT_LOCATION}}.</p>
<p>Wir würden uns sehr freuen, Sie bei dieser besonderen Veranstaltung begrüßen zu dürfen.</p>
<p>Bitte bestätigen Sie Ihre Teilnahme:</p>
<p><a href="{{ACCEPT_LINK}}">Zusage</a> | <a href="{{DECLINE_LINK}}">Absage</a></p>
<p>Mit freundlichen Grüßen<br>Ihr Organisationsteam</p>`,
          plainText: `Liebe/r {{GUEST_NAME}},\n\nwir laden Sie herzlich ein zum Iftar-Essen am {{EVENT_DATE}} um {{EVENT_LOCATION}}.\n\nWir würden uns sehr freuen, Sie bei dieser besonderen Veranstaltung begrüßen zu dürfen.\n\nBitte bestätigen Sie Ihre Teilnahme über die Links in der E-Mail.\n\nMit freundlichen Grüßen\nIhr Organisationsteam`,
          isDefault: true,
        },
      })
    }

    // Hole aktive Email-Config (optional - kann auch null sein)
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
    })

    // Generiere Tokens
    const acceptToken = crypto.randomBytes(32).toString('hex')
    const declineToken = crypto.randomBytes(32).toString('hex')
    const trackingToken = crypto.randomBytes(32).toString('hex')

    // Erstelle Einladung in DB (ohne E-Mail zu senden)
    const invitation = await prisma.invitation.create({
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
        emailConfigId: emailConfig?.id || null, // Optional: kann null sein
        response: 'PENDING',
        // sentAt wird nicht gesetzt, da keine E-Mail gesendet wird
      },
    })

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Erstellen der Einladung:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const hint =
      /does not exist|relation.*not found/i.test(errorMessage)
        ? ' Tabellen fehlen evtl. – auf Railway: railway run npx prisma migrate deploy'
        : ''
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Einladung', details: errorMessage + hint },
      { status: 500 }
    )
  }
}
