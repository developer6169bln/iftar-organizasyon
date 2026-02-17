import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

function generateCheckInToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * POST – Teilnahme manuell akzeptieren und QR-Code für eine Anmeldung generieren.
 * Body: { registrationId: string, eventId: string }
 * Erstellt Gast + Einladung, setzt invitationSentAt.
 * Rückgabe: acceptToken, checkInToken, eventTitle, fullName
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const registrationId = typeof body?.registrationId === 'string' ? body.registrationId.trim() : ''
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : ''

    if (!registrationId || !eventId) {
      return NextResponse.json(
        { error: 'registrationId und eventId sind erforderlich.' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    })

    if (!registration) {
      return NextResponse.json(
        { error: 'Anmeldung nicht gefunden.' },
        { status: 404 }
      )
    }

    if (registration.invitationSentAt) {
      return NextResponse.json(
        { error: 'Teilnahme wurde bereits für diese Anmeldung bestätigt.' },
        { status: 400 }
      )
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden.' },
        { status: 404 }
      )
    }

    const firstName = registration.firstName?.trim() ?? ''
    const lastName = registration.lastName?.trim() ?? ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (!fullName) {
      return NextResponse.json(
        { error: 'Anmeldung hat keinen gültigen Namen.' },
        { status: 400 }
      )
    }

    const district = registration.district?.trim() || null
    const notes = registration.notes?.trim() || null
    const mainGuestCheckInToken = generateCheckInToken()

    const additionalData: Record<string, string | boolean> = {
      Vorname: firstName,
      Nachname: lastName,
      Einladungsliste: true,
      Zusage: true,
      'Zusage Datum': new Date().toISOString(),
      Absage: false,
    }
    if (district) additionalData['Bezirk'] = district
    if (notes) additionalData['Notizen'] = notes

    const existingGuest = await prisma.guest.findFirst({
      where: {
        eventId,
        OR: [
          { email: registration.email },
          { name: { equals: fullName, mode: 'insensitive' } },
        ],
      },
      include: { invitations: { where: { eventId }, take: 1 } },
    })

    if (existingGuest?.invitations?.[0]) {
      const inv = existingGuest.invitations[0]
      await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { invitationSentAt: new Date() },
      })
      return NextResponse.json({
        success: true,
        message: 'Einladung existiert bereits.',
        acceptToken: inv.acceptToken,
        checkInToken: existingGuest.checkInToken ?? mainGuestCheckInToken,
        eventTitle: event.title,
        fullName,
      })
    }

    let guestId: string
    if (!existingGuest) {
      const created = await prisma.guest.create({
        data: {
          eventId,
          name: fullName,
          email: registration.email || null,
          phone: registration.phone || null,
          notes,
          organization: district || null,
          status: 'CONFIRMED',
          checkInToken: mainGuestCheckInToken,
          additionalData: JSON.stringify(additionalData),
        },
      })
      guestId = created.id
    } else {
      await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          status: 'CONFIRMED',
          checkInToken: mainGuestCheckInToken,
          additionalData: JSON.stringify(additionalData),
        },
      })
      guestId = existingGuest.id
    }

    const acceptToken = randomBytes(32).toString('hex')
    const declineToken = randomBytes(32).toString('hex')
    const trackingToken = randomBytes(32).toString('hex')

    let template = await prisma.emailTemplate.findFirst({
      where: { language: 'de', category: '', isDefault: true },
    })
    if (!template) {
      template = await prisma.emailTemplate.findFirst({ where: { language: 'de', category: '' } })
    }
    const subject = template?.subject ?? 'Einladung'
    const bodyText = template?.body ?? '<p>Einladung</p>'

    await prisma.invitation.create({
      data: {
        guestId,
        eventId,
        templateId: template?.id ?? null,
        language: 'de',
        subject,
        body: bodyText,
        acceptToken,
        declineToken,
        trackingToken,
        response: 'ACCEPTED',
        respondedAt: new Date(),
        sentAt: new Date(),
        accompanyingGuestsCount: 1,
      },
    })

    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { invitationSentAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: 'Teilnahme bestätigt. QR-Code wurde generiert.',
      acceptToken,
      checkInToken: mainGuestCheckInToken,
      eventTitle: event.title,
      fullName,
    })
  } catch (error) {
    console.error('Fehler bei accept-participation:', error)
    return NextResponse.json(
      { error: 'Teilnahme konnte nicht bestätigt werden.' },
      { status: 500 }
    )
  }
}
