import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'
import { getUserIdFromRequest } from '@/lib/auditLog'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { guestIds, templateId, language, eventId } = await request.json()

    if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json(
        { error: 'Gästeliste erforderlich' },
        { status: 400 }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID erforderlich' },
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
    let template
    if (templateId) {
      template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      })
    } else {
      // Hole Standard-Template für Sprache
      template = await prisma.emailTemplate.findFirst({
        where: {
          language: language || 'de',
          isDefault: true,
        },
      })
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Email-Template nicht gefunden' },
        { status: 404 }
      )
    }

    // Hole aktive Email-Konfiguration
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
    })

    if (!emailConfig) {
      return NextResponse.json(
        { error: 'Keine aktive Email-Konfiguration gefunden' },
        { status: 400 }
      )
    }

    // Hole Gäste
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        eventId,
      },
    })

    if (guests.length === 0) {
      return NextResponse.json(
        { error: 'Keine Gäste gefunden' },
        { status: 404 }
      )
    }

    const results = []
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin

    // Erstelle Einladungen für jeden Gast
    for (const guest of guests) {
      if (!guest.email) {
        results.push({
          guestId: guest.id,
          guestName: guest.name,
          success: false,
          error: 'Keine E-Mail-Adresse',
        })
        continue
      }

      try {
        // Generiere Tokens
        const acceptToken = crypto.randomBytes(32).toString('hex')
        const declineToken = crypto.randomBytes(32).toString('hex')
        const trackingToken = crypto.randomBytes(32).toString('hex')

        // Erstelle Einladung in DB
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
            emailConfigId: emailConfig.id,
            response: 'PENDING',
          },
        })

        // Erstelle Links
        const acceptLink = `${baseUrl}/invitation/accept/${acceptToken}`
        const declineLink = `${baseUrl}/invitation/decline/${declineToken}`
        const trackingPixelUrl = `${baseUrl}/api/invitations/track/${trackingToken}`

        // Personalisiere Template
        let personalizedBody = template.body
          .replace(/{{GUEST_NAME}}/g, guest.name)
          .replace(/{{EVENT_TITLE}}/g, event.title)
          .replace(/{{EVENT_DATE}}/g, new Date(event.date).toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }))
          .replace(/{{EVENT_LOCATION}}/g, event.location)
          .replace(/{{ACCEPT_LINK}}/g, acceptLink)
          .replace(/{{DECLINE_LINK}}/g, declineLink)

        let personalizedSubject = template.subject
          .replace(/{{GUEST_NAME}}/g, guest.name)
          .replace(/{{EVENT_TITLE}}/g, event.title)

        // Sende Email
        await sendInvitationEmail(
          guest.email,
          personalizedSubject,
          personalizedBody,
          acceptLink,
          declineLink,
          trackingPixelUrl
        )

        // Aktualisiere Einladung
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: {
            sentAt: new Date(),
            subject: personalizedSubject,
            body: personalizedBody,
          },
        })

        // Aktualisiere Gast: Setze "Einladung geschickt" in additionalData
        try {
          const guestAdditionalData = guest.additionalData ? JSON.parse(guest.additionalData) : {}
          guestAdditionalData['Einladung geschickt'] = true
          guestAdditionalData['Einladung geschickt Datum'] = new Date().toISOString()
          
          await prisma.guest.update({
            where: { id: guest.id },
            data: {
              additionalData: JSON.stringify(guestAdditionalData),
            },
          })
        } catch (e) {
          console.error('Fehler beim Aktualisieren von additionalData für Gast:', guest.id, e)
        }

        results.push({
          guestId: guest.id,
          guestName: guest.name,
          success: true,
          invitationId: invitation.id,
        })
      } catch (error) {
        console.error(`Fehler beim Senden an ${guest.name}:`, error)
        
        // Speichere Fehler in DB
        await prisma.invitation.create({
          data: {
            guestId: guest.id,
            eventId,
            templateId: template.id,
            language: template.language,
            subject: template.subject,
            body: template.body,
            acceptToken: crypto.randomBytes(32).toString('hex'),
            declineToken: crypto.randomBytes(32).toString('hex'),
            trackingToken: crypto.randomBytes(32).toString('hex'),
            emailConfigId: emailConfig.id,
            errorMessage: error instanceof Error ? error.message : 'Unbekannter Fehler',
            response: 'PENDING',
          },
        })

        results.push({
          guestId: guest.id,
          guestName: guest.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      total: results.length,
      successful,
      failed,
      results,
    })
  } catch (error) {
    console.error('Fehler beim Senden der Einladungen:', error)
    return NextResponse.json(
      { error: 'Fehler beim Senden der Einladungen' },
      { status: 500 }
    )
  }
}
