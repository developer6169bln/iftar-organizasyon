import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess } from '@/lib/permissions'
import { sendEmail } from '@/lib/email'

/**
 * POST – Doppelteinträge (gleicher Vorname + Name) finden, Duplikate löschen und E-Mail senden.
 * Body: { eventSlug: string }
 * Behält die erste Anmeldung (älteste), löscht die übrigen und sendet E-Mail an die gelöschten.
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const eventSlug = typeof body?.eventSlug === 'string' ? body.eventSlug.trim() : ''

    if (!eventSlug) {
      return NextResponse.json(
        { error: 'eventSlug ist erforderlich.' },
        { status: 400 }
      )
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventSlug },
      orderBy: { createdAt: 'asc' },
    })

    const key = (r: { firstName: string; lastName: string }) =>
      `${(r.firstName || '').trim().toLowerCase()}|${(r.lastName || '').trim().toLowerCase()}`

    const groups = new Map<string, typeof registrations>()
    for (const r of registrations) {
      const k = key(r)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }

    let deleted = 0
    let emailsSent = 0
    const errors: string[] = []

    for (const [, group] of groups) {
      if (group.length <= 1) continue

      const [keep, ...toDelete] = group
      for (const reg of toDelete) {
        try {
          if (reg.email && reg.email.includes('@')) {
            const subject = 'Doppelteintrag – Ihre Anmeldung wurde entfernt'
            const htmlBody = `
              <p>Guten Tag${reg.firstName ? ` ${reg.firstName}` : ''},</p>
              <p>Doppelteinträge sind nicht erlaubt. Es existiert bereits eine Anmeldung mit Ihrem Namen (${reg.firstName} ${reg.lastName}).</p>
              <p>Ihre doppelte Anmeldung wurde daher entfernt.</p>
              <p>Falls Sie Ihre Daten ändern möchten oder Fragen haben, wenden Sie sich bitte an uns.</p>
              <p>Mit freundlichen Grüßen<br/>Ihr Veranstaltungsteam</p>
            `
            const textBody = htmlBody.replace(/<[^>]*>/g, '')
            await sendEmail(reg.email, subject, htmlBody, textBody)
            emailsSent++
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen'
          errors.push(`${reg.firstName} ${reg.lastName} (${reg.email}): ${msg}`)
        }

        await prisma.eventRegistration.delete({
          where: { id: reg.id },
        })
        deleted++
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Fehler beim Entfernen von Duplikaten:', error)
    return NextResponse.json(
      { error: 'Duplikate konnten nicht entfernt werden.' },
      { status: 500 }
    )
  }
}
