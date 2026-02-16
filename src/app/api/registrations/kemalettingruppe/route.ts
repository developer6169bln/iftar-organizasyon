import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

const EVENT_SLUG = 'kemalettingruppe'

function generateCheckInToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * POST – Öffentliche Registrierung für Kemalettingruppe (ohne Auth).
 * Body: firstName, lastName, district?, phone (Pflichtfeld), email, participating (boolean), notes?, eventId? (bei participating=true erforderlich)
 *
 * Bei participating=true und eventId:
 * - Gast wird in Gästeliste übernommen
 * - Einladung wird erstellt (response ACCEPTED, sentAt gesetzt – ohne E-Mail zu senden)
 * - EventRegistration.invitationSentAt wird gesetzt
 * - Rückgabe: acceptToken, checkInTokens, eventTitle für QR-Anzeige
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Vorname und Name sind erforderlich.' },
        { status: 400 }
      )
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' },
        { status: 400 }
      )
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'Bitte geben Sie eine Telefonnummer ein.' },
        { status: 400 }
      )
    }

    const district = typeof body?.district === 'string' ? body.district.trim() || null : null
    const participating = body?.participating !== false
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() || null : null

    const registration = await prisma.eventRegistration.create({
      data: {
        eventSlug: EVENT_SLUG,
        firstName,
        lastName,
        district,
        phone,
        email,
        participating,
        notes,
      },
    })

    if (participating && eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId } })
      if (!event) {
        return NextResponse.json(
          { error: 'Event nicht gefunden. Bitte verwenden Sie den korrekten Anmeldelink.' },
          { status: 400 }
        )
      }

      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
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

      const guest = await prisma.guest.create({
        data: {
          eventId,
          name: fullName,
          email,
          phone,
          notes,
          organization: district || null,
          status: 'CONFIRMED',
          checkInToken: mainGuestCheckInToken,
          additionalData: JSON.stringify(additionalData),
        },
      })

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
          guestId: guest.id,
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

      const checkInTokens = [
        { label: fullName, token: mainGuestCheckInToken, type: 'main' as const },
      ]

      return NextResponse.json({
        success: true,
        message: 'Vielen Dank für Ihre Anmeldung!',
        id: registration.id,
        participating: true,
        acceptToken,
        checkInTokens,
        eventTitle: event.title,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Vielen Dank für Ihre Anmeldung!',
      id: registration.id,
    })
  } catch (error) {
    console.error('Fehler bei Kemalettingruppe-Registrierung:', error)
    return NextResponse.json(
      { error: 'Die Anmeldung konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.' },
      { status: 500 }
    )
  }
}
