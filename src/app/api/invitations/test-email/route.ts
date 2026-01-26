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
        { 
          error: 'Keine aktive Email-Konfiguration gefunden',
          details: 'Bitte konfigurieren Sie zuerst eine Email-Konfiguration im Bereich "Email-Konfiguration"'
        },
        { status: 400 }
      )
    }

    // Prüfe ob Email-Konfiguration vollständig ist
    if (!emailConfig.email) {
      return NextResponse.json(
        { 
          error: 'Email-Konfiguration unvollständig',
          details: 'Bitte geben Sie eine E-Mail-Adresse in der Email-Konfiguration ein'
        },
        { status: 400 }
      )
    }

    if (emailConfig.type === 'GMAIL' && !emailConfig.appPassword && !emailConfig.password) {
      return NextResponse.json(
        { 
          error: 'Gmail-Konfiguration unvollständig',
          details: 'Bitte geben Sie ein App-Passwort für Gmail in der Email-Konfiguration ein'
        },
        { status: 400 }
      )
    }

    if (emailConfig.type === 'IMAP' && (!emailConfig.smtpHost || !emailConfig.password)) {
      return NextResponse.json(
        { 
          error: 'SMTP-Konfiguration unvollständig',
          details: 'Bitte geben Sie SMTP-Host und Passwort in der Email-Konfiguration ein'
        },
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
    try {
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
    } catch (emailError) {
      console.error('Fehler beim Senden der E-Mail:', emailError)
      
      // Detaillierte Fehlermeldung basierend auf Fehlertyp
      let errorDetails = 'Unbekannter Fehler beim Senden der E-Mail'
      
      if (emailError instanceof Error) {
        const errorMessage = emailError.message.toLowerCase()
        
        if (errorMessage.includes('invalid login') || errorMessage.includes('authentication failed')) {
          errorDetails = 'Email-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre Email-Konfiguration (E-Mail-Adresse und Passwort/App-Passwort).'
        } else if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          errorDetails = 'Verbindung zum Email-Server fehlgeschlagen. Bitte überprüfen Sie Ihre SMTP-Einstellungen.'
        } else if (errorMessage.includes('email-server verbindung')) {
          errorDetails = 'Email-Server Verbindung fehlgeschlagen. Bitte überprüfen Sie Ihre Email-Konfiguration.'
        } else {
          errorDetails = emailError.message
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Fehler beim Senden der Test-E-Mail',
          details: errorDetails
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Fehler in Test-E-Mail API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { 
        error: 'Fehler beim Verarbeiten der Anfrage', 
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
