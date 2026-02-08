import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getProjectsForUser, canSubmitToJotform } from '@/lib/permissions'

/**
 * Bestehenden Entwurf „an JotForm senden“ markieren.
 * Nur berechtigte User; nur Entwürfe (submittedAt bisher null).
 * Setzt submittedAt und submittedByUserId.
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
    select: { projectId: true, submittedAt: true },
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
  const updated = await prisma.jotFormSubmission.update({
    where: { id },
    data: {
      submittedByUserId: userId,
      submittedAt: new Date(),
    },
    include: {
      enteredBy: { select: { id: true, name: true, email: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(updated)
}
