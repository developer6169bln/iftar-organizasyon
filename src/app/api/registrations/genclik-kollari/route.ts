import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EVENT_SLUG = 'genclik-kollari'

/**
 * POST – Öffentliche Registrierung für Gençlik Kolları (ohne Auth).
 * Body: firstName, lastName, district?, phone?, email, participating (boolean), notes?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

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

    const district = typeof body?.district === 'string' ? body.district.trim() || null : null
    const phone = typeof body?.phone === 'string' ? body.phone.trim() || null : null
    const participating = body?.participating !== false
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null

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

    return NextResponse.json({
      success: true,
      message: 'Vielen Dank für Ihre Anmeldung!',
      id: registration.id,
    })
  } catch (error) {
    console.error('Fehler bei Gençlik-Kolları-Registrierung:', error)
    return NextResponse.json(
      { error: 'Die Anmeldung konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.' },
      { status: 500 }
    )
  }
}
