import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { email, templateId, eventId, includeLinks = true } = await request.json()

    if (!email || !templateId || !eventId) {
      return NextResponse.json(
        { error: 'E-Mail, Template-ID und Event-ID sind erforderlich' },
        { status: 400 }
      )
    }

    // Hole Event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    // Hole Template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template nicht gefunden' },
        { status: 404 }
      )
    }

    // Hole aktive Email-Config
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
    })

    if (!emailConfig) {
      return NextResponse.json(
        { error: 'Keine aktive Email-Konfiguration gefunden' },
        { status: 400 }
      )
    }

    // Generiere Test-Tokens
    const acceptToken = crypto.randomBytes(32).toString('hex')
    const declineToken = crypto.randomBytes(32).toString('hex')
    const trackingToken = crypto.randomBytes(32).toString('hex')

    // Erstelle Test-Links
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (request.headers.get('origin') || `https://${request.headers.get('host') || 'localhost:3000'}`)
    
    const acceptLink = `${baseUrl}/invitation/accept/${acceptToken}`
    const declineLink = `${baseUrl}/invitation/decline/${declineToken}`
    const trackingPixelUrl = `${baseUrl}/api/invitations/track/${trackingToken}`

    // Personalisiere Template mit Test-Daten
    let personalizedBody = template.body
      .replace(/{{GUEST_NAME}}/g, 'Test-Gast')
      .replace(/{{EVENT_TITLE}}/g, event.title)
      .replace(/{{EVENT_DATE}}/g, new Date(event.date).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }))
      .replace(/{{EVENT_LOCATION}}/g, event.location || '')
    
    // Links optional einfügen
    if (includeLinks) {
      personalizedBody = personalizedBody
        .replace(/{{ACCEPT_LINK}}/g, acceptLink)
        .replace(/{{DECLINE_LINK}}/g, declineLink)
    } else {
      personalizedBody = personalizedBody
        .replace(/{{ACCEPT_LINK}}/g, '')
        .replace(/{{DECLINE_LINK}}/g, '')
    }

    let personalizedSubject = template.subject
      .replace(/{{GUEST_NAME}}/g, 'Test-Gast')
      .replace(/{{EVENT_TITLE}}/g, event.title)

    // Sende Test-E-Mail
    await sendInvitationEmail(
      email,
      personalizedSubject,
      personalizedBody,
      acceptLink,
      declineLink,
      trackingPixelUrl
    )

    return NextResponse.json({
      success: true,
      message: 'Test-E-Mail erfolgreich gesendet',
      acceptLink,
      declineLink,
    })
  } catch (error) {
    console.error('Fehler beim Senden der Test-E-Mail:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: 'Fehler beim Senden der Test-E-Mail', details: errorMessage },
      { status: 500 }
    )
  }
}
