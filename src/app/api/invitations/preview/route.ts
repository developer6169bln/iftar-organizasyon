import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

function getGuestStaatInstitution(guest: { organization?: string | null; additionalData?: string | null } | null): string {
  if (!guest) return ''
  if (guest.organization != null && String(guest.organization).trim() !== '') return String(guest.organization).trim()
  if (!guest.additionalData) return ''
  try {
    const ad = JSON.parse(guest.additionalData) as Record<string, unknown>
    const keys = ['Staat/Institution', 'Staat / Institution', 'StaatInstitution', 'Institution', 'Staat']
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(ad, key) && ad[key] != null) {
        const v = String(ad[key]).trim()
        if (v !== '') return v
      }
    }
    for (const [key, value] of Object.entries(ad)) {
      const k = String(key).toLowerCase()
      if ((k.includes('staat') || k.includes('institution')) && value != null && String(value).trim() !== '') return String(value).trim()
    }
  } catch {
    // ignore
  }
  return ''
}

/** Vorname aus guest.additionalData oder erstes Wort von guest.name (für Platzhalter {{VORNAME}}). */
function getGuestVorname(guest: { name: string; additionalData?: string | null } | null): string {
  if (!guest) return ''
  if (guest.additionalData) {
    try {
      const ad = JSON.parse(guest.additionalData) as Record<string, unknown>
      const keys = ['Vorname', 'firstName', 'first_name', 'First Name']
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(ad, key) && ad[key] != null) {
          const v = String(ad[key]).trim()
          if (v !== '') return v
        }
      }
      for (const [key, value] of Object.entries(ad)) {
        const k = String(key).toLowerCase()
        if ((k === 'vorname' || k === 'firstname' || k === 'first_name') && value != null && String(value).trim() !== '') return String(value).trim()
      }
    } catch {
      // ignore
    }
  }
  const firstWord = String(guest.name).trim().split(/\s+/)[0]
  return firstWord ?? ''
}

/** Anrede 2 aus guest.additionalData (Platzhalter {{ANREDE_2}}). */
function getGuestAnrede2(guest: { additionalData?: string | null } | null): string {
  if (!guest?.additionalData) return ''
  try {
    const ad = JSON.parse(guest.additionalData) as Record<string, unknown>
    const keys = ['Anrede 2', 'Anrede2', 'Anrede_2']
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(ad, key) && ad[key] != null) {
        const v = String(ad[key]).trim()
        if (v !== '') return v
      }
    }
  } catch {
    // ignore
  }
  return ''
}

/** GET: Personalisierte Mail-Vorschau für eine Einladung (optional mit templateId). */
export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitationId')
    const templateId = searchParams.get('templateId')

    if (!invitationId) {
      return NextResponse.json({ error: 'invitationId ist erforderlich' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: true,
            additionalData: true,
          },
        },
        event: { select: { id: true, title: true, date: true, location: true } },
        template: { select: { id: true, subject: true, body: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    const eventAccess = await requireEventAccess(request, invitation.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    let template = invitation.template
    if (templateId && templateId !== invitation.templateId) {
      const override = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, subject: true, body: true },
      })
      if (override) template = override
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Kein Template für diese Einladung. Bitte weisen Sie der Einladung ein Template zu.' },
        { status: 404 }
      )
    }

    const guest = invitation.guest
    const event = invitation.event
    if (!guest || !event) {
      return NextResponse.json({ error: 'Gast oder Event fehlt' }, { status: 400 })
    }

    const baseUrl = getBaseUrlForInvitationEmails(request)
    const acceptLink = `${baseUrl}/api/invitations/accept/${invitation.acceptToken}`
    const declineLink = `${baseUrl}/api/invitations/decline/${invitation.declineToken}`

    const staatInstitution = getGuestStaatInstitution(guest)
    const vorname = getGuestVorname(guest)
    const anrede2 = getGuestAnrede2(guest)
    const eventDateStr = new Date(event.date).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    let subject = template.subject
      .replace(/{{GUEST_NAME}}/g, guest.name)
      .replace(/{{VORNAME}}/g, vorname)
      .replace(/{{ANREDE_2}}/g, anrede2)
      .replace(/{{EVENT_TITLE}}/g, event.title)
      .replace(/{{STAAT_INSTITUTION}}/g, staatInstitution)

    let body = template.body
      .replace(/{{GUEST_NAME}}/g, guest.name)
      .replace(/{{VORNAME}}/g, vorname)
      .replace(/{{ANREDE_2}}/g, anrede2)
      .replace(/{{EVENT_TITLE}}/g, event.title)
      .replace(/{{EVENT_DATE}}/g, eventDateStr)
      .replace(/{{EVENT_LOCATION}}/g, event.location)
      .replace(/{{STAAT_INSTITUTION}}/g, staatInstitution)
      .replace(/{{ACCEPT_LINK}}/g, acceptLink)
      .replace(/{{DECLINE_LINK}}/g, declineLink)

    return NextResponse.json({ subject, body, guestName: guest.name })
  } catch (error) {
    console.error('Fehler bei Mail-Vorschau:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erzeugen der Vorschau' },
      { status: 500 }
    )
  }
}
