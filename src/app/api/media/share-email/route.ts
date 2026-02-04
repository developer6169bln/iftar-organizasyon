import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { requireEventAccess, requireAnyPageAccess } from '@/lib/permissions'

/** Ausgewählte Medien per E-Mail teilen. POST body: { to: string, ids: string[], message?: string } */
export async function POST(request: NextRequest) {
  const access = await requireAnyPageAccess(request, ['foto-video', 'media-upload'])
  if (access instanceof NextResponse) return access

  let body: { to?: string; ids?: string[]; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Gültige E-Mail-Adresse (to) erforderlich' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Mindestens eine Medien-ID (ids) erforderlich' }, { status: 400 })
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Maximal 50 Medien auf einmal' }, { status: 400 })
  }

  const items = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
  })
  const allowed: typeof items = []
  for (const item of items) {
    const eventAccess = await requireEventAccess(request, item.eventId)
    if (eventAccess instanceof NextResponse) continue
    allowed.push(item)
  }
  if (allowed.length === 0) {
    return NextResponse.json({ error: 'Kein Zugriff auf die ausgewählten Medien' }, { status: 403 })
  }

  const baseUrl = getBaseUrlForInvitationEmails(request)
  const dashboardLink = `${baseUrl}/dashboard/foto-video`
  const customMessage = typeof body.message === 'string' ? body.message.trim() : ''
  const titles = allowed.map((m) => m.title || m.fileName || '(ohne Titel)').join(', ')
  const subject = 'Geteilte Fotos/Videos – Iftar Organizasyon'
  const htmlBody = `
    <p>Sie haben Fotos/Videos mit Ihnen geteilt.</p>
    ${customMessage ? `<p>${customMessage.replace(/\n/g, '<br>')}</p>` : ''}
    <p><strong>Enthalten:</strong> ${titles}</p>
    <p>Melden Sie sich in der App an, um die Medien anzuzeigen und herunterzuladen:</p>
    <p><a href="${dashboardLink}">${dashboardLink}</a></p>
    <p>Mit freundlichen Grüßen<br>Iftar Organizasyon</p>
  `
  const textBody = `Sie haben Fotos/Videos mit Ihnen geteilt. Enthalten: ${titles}. Öffnen Sie ${dashboardLink} und melden Sie sich an.`

  try {
    await sendEmail(to, subject, htmlBody, textBody)
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
