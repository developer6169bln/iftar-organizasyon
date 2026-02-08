import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getProjectsForUser, canSubmitToJotform } from '@/lib/permissions'
import { z } from 'zod'

const FORM_TYPES = ['ETKINLIK_FORMU', 'ETKINLIK_RAPORU'] as const

/** Einträge auflisten (Entwürfe + gesendete) */
export async function GET(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const projectId = request.nextUrl.searchParams.get('projectId')
  const formType = request.nextUrl.searchParams.get('formType')
  if (!projectId) return NextResponse.json({ error: 'projectId fehlt' }, { status: 400 })
  const projects = await getProjectsForUser(userId)
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  const where: { projectId: string; formType?: string } = { projectId }
  if (formType && FORM_TYPES.includes(formType as any)) where.formType = formType
  const list = await prisma.jotFormSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      enteredBy: { select: { id: true, name: true, email: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(list)
}

const createSchema = z.object({
  projectId: z.string(),
  eventId: z.string().optional(),
  formType: z.enum(FORM_TYPES),
  data: z.record(z.unknown()),
  submitToJotform: z.boolean().optional(), // true = an JotForm senden (nur wenn berechtigt)
})

/** Eintrag speichern (Entwurf) oder an JotForm senden (nur mit Berechtigung) */
export async function POST(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'projectId, formType und data erforderlich' }, { status: 400 })
  }
  const { projectId, eventId, formType, data, submitToJotform } = parsed.data
  const projects = await getProjectsForUser(userId)
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  if (submitToJotform) {
    const can = await canSubmitToJotform(projectId, userId)
    if (!can) {
      return NextResponse.json({ error: 'Sie sind nicht berechtigt, Formulardaten an JotForm zu senden' }, { status: 403 })
    }
    // TODO: JotForm Submit API aufrufen (Form-ID aus jotform_forms, Daten mappen), dann jotformSubmissionId setzen
    // Für jetzt: Eintrag als „gesendet“ speichern ohne echten JotForm-Call
  }
  const submission = await prisma.jotFormSubmission.create({
    data: {
      projectId,
      eventId: eventId || null,
      formType,
      enteredByUserId: userId,
      submittedByUserId: submitToJotform ? userId : null,
      submittedAt: submitToJotform ? new Date() : null,
      data: JSON.stringify(data),
    },
    include: {
      enteredBy: { select: { id: true, name: true, email: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(submission)
}
