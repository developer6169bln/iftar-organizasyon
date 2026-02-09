import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getProjectsForUser, canSubmitToJotform } from '@/lib/permissions'

/**
 * Bestehenden Entwurf an JotForm übermitteln (POST an JotForm) und als gesendet markieren.
 * Nur berechtigte User (Admin, Projekt-Inhaber/Hauptbenutzer oder explizit berechtigt); nur Entwürfe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { id } = await params
  const submission = await prisma.jotFormSubmission.findUnique({
    where: { id },
    select: { projectId: true, formType: true, submittedAt: true, data: true },
  })
  if (!submission) {
    return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
  }
  const projects = await getProjectsForUser(userId)
  if (!projects.some((p) => p.id === submission.projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  if (submission.submittedAt) {
    return NextResponse.json({ error: 'Dieser Eintrag wurde bereits an JotForm gesendet' }, { status: 400 })
  }
  const can = await canSubmitToJotform(submission.projectId, userId)
  if (!can) {
    return NextResponse.json({ error: 'Sie sind nicht berechtigt, Formulardaten an JotForm zu senden' }, { status: 403 })
  }

  const form = await prisma.jotFormForm.findUnique({
    where: { projectId_formType: { projectId: submission.projectId, formType: submission.formType } },
    select: { jotformFormId: true },
  })
  if (!form?.jotformFormId) {
    return NextResponse.json({ error: 'Für dieses Formular wurde noch keine JotForm-URL importiert' }, { status: 400 })
  }

  let formData: Record<string, string>
  try {
    formData = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data
  } catch {
    return NextResponse.json({ error: 'Formulardaten sind ungültig' }, { status: 400 })
  }

  const submitUrl = `https://submit.jotform.com/submit/${form.jotformFormId}`
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(formData)) {
    if (value != null && typeof value === 'string') body.append(key, value)
    else if (value != null) body.append(key, String(value))
  }

  let jotformSubmissionId: string | null = null
  try {
    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error('JotForm submit error:', res.status, text)
      return NextResponse.json(
        { error: 'JotForm hat die Übermittlung abgelehnt. Bitte Daten prüfen oder später erneut versuchen.' },
        { status: 502 }
      )
    }
    const sidMatch = text.match(/submission_id["\s:]+(\d+)/i) || text.match(/Submission ID["\s:]+(\d+)/i)
    if (sidMatch) jotformSubmissionId = sidMatch[1]
  } catch (e) {
    console.error('JotForm submit request error:', e)
    return NextResponse.json(
      { error: 'JotForm war nicht erreichbar. Bitte später erneut versuchen.' },
      { status: 502 }
    )
  }

  const updated = await prisma.jotFormSubmission.update({
    where: { id },
    data: {
      submittedByUserId: userId,
      submittedAt: new Date(),
      jotformSubmissionId,
    },
    include: {
      enteredBy: { select: { id: true, name: true, email: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(updated)
}
