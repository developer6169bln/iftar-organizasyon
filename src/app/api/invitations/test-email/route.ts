import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30 // 30 Sekunden Timeout für diese Route

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    console.log('📧 Test-E-Mail Anfrage erhalten:', {
      timestamp: new Date().toISOString(),
    })
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

    // Erstelle Test-Links (App-URL, kein localhost)
    const baseUrl = getBaseUrlForInvitationEmails(request)
    
    const acceptLink = `${baseUrl}/api/invitations/accept/${acceptToken}`
    const declineLink = `${baseUrl}/api/invitations/decline/${declineToken}`
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
      console.log('📧 Starte E-Mail-Versand...')
      const emailStartTime = Date.now()
      
      await sendInvitationEmail(
        email,
        personalizedSubject,
        personalizedBody,
        acceptLink,
        declineLink,
        trackingPixelUrl
      )
      
      const emailDuration = Date.now() - emailStartTime
      const totalDuration = Date.now() - startTime
      console.log(`✅ E-Mail erfolgreich gesendet (Dauer: ${emailDuration}ms, Gesamt: ${totalDuration}ms)`)

      return NextResponse.json({
        success: true,
        message: 'Test-E-Mail erfolgreich gesendet',
        acceptLink,
        declineLink,
      })
    } catch (emailError) {
      console.error('❌ Fehler beim Senden der E-Mail:', emailError)
      
      // Detailliertes Logging
      if (emailError instanceof Error) {
        console.error('❌ Fehler-Stack:', emailError.stack)
        console.error('❌ Fehler-Code:', (emailError as any).code)
        console.error('❌ Response-Code:', (emailError as any).responseCode)
      }
      
      // Die Fehlermeldung kommt bereits von sendInvitationEmail (benutzerfreundlich formatiert)
      const errorDetails = emailError instanceof Error ? emailError.message : 'Unbekannter Fehler beim Senden der E-Mail'
      
      return NextResponse.json(
        { 
          error: 'Fehler beim Senden der Test-E-Mail',
          details: errorDetails,
          // In Development: Mehr Details
          ...(process.env.NODE_ENV === 'development' && emailError instanceof Error ? {
            stack: emailError.stack,
            code: (emailError as any).code,
            responseCode: (emailError as any).responseCode,
          } : {})
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`❌ Fehler in Test-E-Mail API (Dauer: ${totalDuration}ms):`, error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    
    // Prüfe ob es ein Timeout-Fehler ist
    if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      return NextResponse.json(
        { 
          error: 'Zeitüberschreitung beim Senden der E-Mail',
          details: 'Die E-Mail-Versand hat zu lange gedauert. Bitte versuchen Sie es erneut oder überprüfen Sie Ihre Email-Konfiguration.'
        },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Fehler beim Verarbeiten der Anfrage', 
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
