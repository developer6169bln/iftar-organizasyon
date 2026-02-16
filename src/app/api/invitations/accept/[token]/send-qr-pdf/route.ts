import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { buildQrPdf, EVENT_DETAILS_TEXT } from '@/lib/qrPdf'
import { sendEmailWithAttachment } from '@/lib/email'

export const runtime = 'nodejs'

/** E-Mail des Hauptgasts aus guest.email oder additionalData. */
function getGuestEmail(guest: { email: string | null; additionalData: string | null } | null): string | null {
  if (!guest) return null
  const main = guest.email && String(guest.email).trim()
  if (main) return main
  if (!guest.additionalData) return null
  try {
    const ad = JSON.parse(guest.additionalData) as Record<string, unknown>
    const kurumsal = ad['E-Mail kurumsal']
    const privat = ad['E-Mail privat']
    const k = kurumsal != null && String(kurumsal).trim() ? String(kurumsal).trim() : ''
    const p = privat != null && String(privat).trim() ? String(privat).trim() : ''
    if (k) return k
    if (p) return p
  } catch {
    // ignore
  }
  return null
}

/**
 * POST – PDF mit Eventinfos und QR-Codes per E-Mail an den Hauptgast senden.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { acceptToken: token },
      include: {
        guest: { select: { name: true, checkInToken: true, email: true, additionalData: true } },
        event: { select: { title: true, date: true, location: true } },
        accompanyingGuests: { select: { firstName: true, lastName: true, checkInToken: true } },
      },
    })

    if (!invitation || invitation.response !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden oder noch nicht zugesagt' },
        { status: 404 }
      )
    }

    const to = getGuestEmail(invitation.guest)
    if (!to || !to.includes('@')) {
      return NextResponse.json(
        { error: 'Keine gültige E-Mail-Adresse für den Hauptgast hinterlegt. Bitte in der Gästeliste ergänzen.' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrlForInvitationEmails(request)
    const { buffer, filename } = await buildQrPdf(invitation, baseUrl)
    const eventTitle = invitation.event?.title ?? 'Veranstaltung'

    const subject = `Check-in & Eventinformationen – ${eventTitle}`
    const detailsHtml = EVENT_DETAILS_TEXT.split('\n').join('<br/>')
    const htmlBody = `
      <p>Guten Tag${invitation.guest?.name ? ` ${invitation.guest.name}` : ''},</p>
      <p>anbei erhalten Sie Ihre Check-in-QR-Codes und Eventinformationen für <strong>${eventTitle}</strong>.</p>
      <p>Bitte zeigen Sie am Eventtag beim Einlass den jeweiligen QR-Code zum Scannen. Jede Person hat einen eigenen Code.</p>
      <div style="margin: 1em 0; padding: 1em; background: #f5f5f5; border-radius: 8px; white-space: pre-line;">
        ${detailsHtml}
      </div>
      <p>Sie können dieses PDF ausdrucken oder auf dem Smartphone bereithalten.</p>
      <p>Mit freundlichen Grüßen<br/>Ihr Veranstaltungsteam</p>
    `
    const textBody = htmlBody.replace(/<[^>]*>/g, '')

    await sendEmailWithAttachment(to, subject, htmlBody, textBody, {
      filename,
      content: buffer,
    })

    return NextResponse.json({ success: true, message: 'PDF wurde an Ihre E-Mail-Adresse gesendet.' })
  } catch (error) {
    console.error('Fehler beim Senden des QR-PDF per E-Mail:', error)
    const message = error instanceof Error ? error.message : 'E-Mail konnte nicht gesendet werden.'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
