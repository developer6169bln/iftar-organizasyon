import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'
import { getBaseUrlForInvitationEmails, isLocalhostUrl } from '@/lib/appUrl'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

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

/** Erneutes Senden von Einladungs-E-Mails für bestehende Einladungen (gleiche Links/Tokens). */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access
  try {
    const { invitationIds } = await request.json()

    if (!invitationIds || !Array.isArray(invitationIds) || invitationIds.length === 0) {
      return NextResponse.json(
        { error: 'Mindestens eine Einladung auswählen' },
        { status: 400 }
      )
    }

    const invitations = await prisma.invitation.findMany({
      where: { id: { in: invitationIds } },
      include: {
        guest: true,
        event: true,
        template: true,
      },
    })

    if (invitations.length === 0) {
      return NextResponse.json(
        { error: 'Keine Einladungen gefunden' },
        { status: 404 }
      )
    }

    const eventId = invitations[0].eventId
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const emailConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
    })
    if (!emailConfig) {
      return NextResponse.json(
        { error: 'Keine aktive Email-Konfiguration gefunden' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrlForInvitationEmails(request)
    if (isLocalhostUrl(baseUrl)) {
      return NextResponse.json(
        {
          error: 'E-Mail-Links dürfen keine localhost-URL enthalten. Bitte setzen Sie NEXT_PUBLIC_BASE_URL (z. B. Ihre Railway-/Produktions-URL) in den Umgebungsvariablen.',
        },
        { status: 400 }
      )
    }
    const results: { invitationId: string; guestName: string; success: boolean; error?: string }[] = []

    for (const inv of invitations) {
      const { guest, event, template } = inv
      const toEmail = getGuestEmail(guest)
      if (!toEmail) {
        results.push({
          invitationId: inv.id,
          guestName: guest?.name ?? '?',
          success: false,
          error: 'Keine E-Mail-Adresse (weder guest.email noch E-Mail kurumsal/privat)',
        })
        continue
      }

      try {
        const acceptLink = `${baseUrl}/api/invitations/accept/${inv.acceptToken}`
        const declineLink = `${baseUrl}/api/invitations/decline/${inv.declineToken}`
        const trackingPixelUrl = `${baseUrl}/api/invitations/track/${inv.trackingToken}`

        let personalizedBody = (template?.body ?? inv.body)
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

        let personalizedSubject = (template?.subject ?? inv.subject)
          .replace(/{{GUEST_NAME}}/g, guest.name)
          .replace(/{{EVENT_TITLE}}/g, event.title)

        await sendInvitationEmail(
          toEmail,
          personalizedSubject,
          personalizedBody,
          acceptLink,
          declineLink,
          trackingPixelUrl
        )

        await prisma.invitation.update({
          where: { id: inv.id },
          data: {
            sentAt: new Date(),
            subject: personalizedSubject,
            body: personalizedBody,
            errorMessage: null,
          },
        })

        try {
          const guestAdditionalData = guest.additionalData ? JSON.parse(guest.additionalData) : {}
          guestAdditionalData['Einladung geschickt'] = true
          guestAdditionalData['Einladung geschickt Datum'] = new Date().toISOString()
          await prisma.guest.update({
            where: { id: guest.id },
            data: { additionalData: JSON.stringify(guestAdditionalData) },
          })
        } catch (e) {
          console.error('Fehler beim Aktualisieren von additionalData für Gast:', guest.id, e)
        }

        results.push({ invitationId: inv.id, guestName: guest.name, success: true })
      } catch (error) {
        console.error(`Resend fehlgeschlagen für Einladung ${inv.id}:`, error)
        const errMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
        await prisma.invitation.update({
          where: { id: inv.id },
          data: { errorMessage: errMsg },
        }).catch(() => {})
        results.push({
          invitationId: inv.id,
          guestName: guest.name,
          success: false,
          error: errMsg,
        })
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      total: results.length,
      successful,
      failed,
      results,
    })
  } catch (error) {
    console.error('Fehler beim erneuten Senden der Einladungen:', error)
    return NextResponse.json(
      { error: 'Fehler beim erneuten Senden der Einladungen' },
      { status: 500 }
    )
  }
}
