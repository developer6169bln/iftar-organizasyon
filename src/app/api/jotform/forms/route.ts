import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { requirePageAccess } from '@/lib/permissions'
import { z } from 'zod'

const FORM_TYPES = ['ETKINLIK_FORMU', 'ETKINLIK_RAPORU'] as const

/** Liste der JotForm-Formulare eines Projekts (mit Feldern) */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const access = await requirePageAccess(request, 'etkinlik-formu', projectId)
  if (access instanceof NextResponse) return access
  if (!projectId) {
    return NextResponse.json({ error: 'projectId fehlt' }, { status: 400 })
  }
  const projects = await import('@/lib/permissions').then((m) => m.getProjectsForUser(access.userId))
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  const forms = await prisma.jotFormForm.findMany({
    where: { projectId },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(forms)
}

const createSchema = z.object({
  projectId: z.string(),
  formType: z.enum(FORM_TYPES),
})

/** Formular anlegen (leer). Import der Felder aus JotForm-URL nur über POST /api/jotform/forms/import (nur Inhaber). */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'etkinlik-formu')
  if (access instanceof NextResponse) return access
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'projectId und formType (ETKINLIK_FORMU | ETKINLIK_RAPORU) erforderlich' }, { status: 400 })
  }
  const { projectId, formType } = parsed.data
  const projects = await import('@/lib/permissions').then((m) => m.getProjectsForUser(access.userId))
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  const existing = await prisma.jotFormForm.findUnique({
    where: { projectId_formType: { projectId, formType } },
  })
  if (existing) {
    return NextResponse.json(existing)
  }
  const form = await prisma.jotFormForm.create({
    data: { projectId, formType },
    include: { fields: true },
  })
  return NextResponse.json(form)
}
