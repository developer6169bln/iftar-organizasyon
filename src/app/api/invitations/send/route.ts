import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'
import { getBaseUrlForInvitationEmails, isLocalhostUrl } from '@/lib/appUrl'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { getGuestCategoryKey } from '@/lib/guestCategory'
import crypto from 'crypto'

/** E-Mail aus guest.email oder additionalData: E-Mail kurumsal / E-Mail privat (erstes vorhandenes). */
function getGuestEmail(guest: { email?: string | null; additionalData?: string | null } | null): string {
  if (!guest) return ''
  const main = guest.email && String(guest.email).trim()
  if (main) return main
  if (!guest.additionalData) return ''
  try {
    const ad = JSON.parse(guest.additionalData) as Record<string, unknown>
    const kurumsal = ad['E-Mail kurumsal']; const privat = ad['E-Mail privat']
    const k = kurumsal != null && String(kurumsal).trim() ? String(kurumsal).trim() : ''
    const p = privat != null && String(privat).trim() ? String(privat).trim() : ''
    if (k) return k
    if (p) return p
    return ''
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access
  try {
    const { guestIds, templateId, language, eventId, includeLinks: includeLinksParam = true } = await request.json()
    const includeLinks = includeLinksParam !== false // Standard: true

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
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

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

    // Bei festem templateId: ein Template für alle; sonst pro Gast nach Kategorie + Sprache wählen
    const useFixedTemplate = !!templateId
    let fixedTemplate: Awaited<ReturnType<typeof prisma.emailTemplate.findUnique>> = null
    if (useFixedTemplate) {
      fixedTemplate = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      })
      if (!fixedTemplate) {
        return NextResponse.json(
          { error: 'Email-Template nicht gefunden' },
          { status: 404 }
        )
      }
    }

    // Alle Templates laden (für pro-Gast-Auswahl nach Kategorie + Sprache)
    const allTemplates = useFixedTemplate
      ? []
      : await prisma.emailTemplate.findMany({
          orderBy: [{ category: 'asc' }, { language: 'asc' }, { isDefault: 'desc' }],
        })

    const lang = language || 'de'

    /** Template für Gast wählen: Kategorie+Sprache (Default), dann Kategorie+Sprache, dann Global+Sprache. */
    function findTemplateForGuest(guest: { additionalData?: string | null }) {
      if (fixedTemplate) return fixedTemplate
      const categoryKey = getGuestCategoryKey(guest)
      const forCategoryDefault = allTemplates.find(
        (x) => x.language === lang && x.category === categoryKey && x.isDefault
      )
      if (forCategoryDefault) return forCategoryDefault
      const forCategory = allTemplates.find((x) => x.language === lang && x.category === categoryKey)
      if (forCategory) return forCategory
      const globalDefault = allTemplates.find(
        (x) => x.language === lang && (x.category === '' || !x.category) && x.isDefault
      )
      if (globalDefault) return globalDefault
      return allTemplates.find((x) => x.language === lang && (x.category === '' || !x.category)) ?? null
    }

    if (!useFixedTemplate && allTemplates.length === 0) {
      return NextResponse.json(
        { error: 'Kein Email-Template vorhanden. Bitte legen Sie mindestens ein Template (z. B. Standard) an.' },
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
    const baseUrl = getBaseUrlForInvitationEmails(request)
    if (isLocalhostUrl(baseUrl)) {
      return NextResponse.json(
        {
          error: 'E-Mail-Links dürfen keine localhost-URL enthalten. Bitte setzen Sie NEXT_PUBLIC_BASE_URL (z. B. Ihre Railway-/Produktions-URL) in den Umgebungsvariablen.',
        },
        { status: 400 }
      )
    }

    // Erstelle Einladungen für jeden Gast
    for (const guest of guests) {
      const toEmail = getGuestEmail(guest)
      if (!toEmail) {
        results.push({
          guestId: guest.id,
          guestName: guest.name,
          success: false,
          error: 'Keine E-Mail-Adresse (weder guest.email noch E-Mail kurumsal/privat)',
        })
        continue
      }

      const template = findTemplateForGuest(guest)
      if (!template) {
        results.push({
          guestId: guest.id,
          guestName: guest.name,
          success: false,
          error: `Kein Template für Kategorie/Sprache gefunden (Sprache: ${lang})`,
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

        // Erstelle Links (API-Routen leiten nach Verarbeitung auf Dankeseite weiter)
        const acceptLink = `${baseUrl}/api/invitations/accept/${acceptToken}`
        const declineLink = `${baseUrl}/api/invitations/decline/${declineToken}`
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
        
        // Links optional einfügen (Standard: true)
        if (includeLinks) {
          personalizedBody = personalizedBody
            .replace(/{{ACCEPT_LINK}}/g, acceptLink)
            .replace(/{{DECLINE_LINK}}/g, declineLink)
        } else {
          // Entferne Links wenn nicht gewünscht
          personalizedBody = personalizedBody
            .replace(/{{ACCEPT_LINK}}/g, '')
            .replace(/{{DECLINE_LINK}}/g, '')
        }

        let personalizedSubject = template.subject
          .replace(/{{GUEST_NAME}}/g, guest.name)
          .replace(/{{EVENT_TITLE}}/g, event.title)

        // Sende Email
        await sendInvitationEmail(
          toEmail,
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
          
          // Benachrichtige Frontend über Update (für automatische Aktualisierung der Gästeliste)
          // Diese Benachrichtigung wird über localStorage-Events kommuniziert
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
