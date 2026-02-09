import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { isProjectOwner, getProjectsForUser } from '@/lib/permissions'
import { z } from 'zod'

const FORM_TYPES = ['ETKINLIK_FORMU', 'ETKINLIK_RAPORU'] as const

/** Form-ID aus JotForm-URL extrahieren (z. B. https://form.jotform.com/212345678901234 → 212345678901234) */
function getJotformFormIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    const match = path.match(/\/(\d{10,})$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

const importSchema = z.object({
  projectId: z.string(),
  formType: z.enum(FORM_TYPES),
  jotformUrl: z.string().url(),
})

/**
 * Felder von JotForm importieren. Projekt-Inhaber oder Admin (App-Inhaber).
 * Setze JOTFORM_API_KEY in den Umgebungsvariablen.
 */
export async function POST(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'projectId, formType und jotformUrl (gültige URL) erforderlich' }, { status: 400 })
  }
  const { projectId, formType, jotformUrl } = parsed.data
  const projects = await getProjectsForUser(userId)
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  const owner = await isProjectOwner(projectId, userId)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  const isAdmin = user?.role === 'ADMIN'
  if (!owner && !isAdmin) {
    return NextResponse.json({ error: 'Nur der Projekt-Inhaber oder der Admin (App-Inhaber) darf Felder aus JotForm importieren' }, { status: 403 })
  }
  const formId = getJotformFormIdFromUrl(jotformUrl)
  if (!formId) {
    return NextResponse.json({ error: 'Aus der JotForm-URL konnte keine Form-ID ermittelt werden' }, { status: 400 })
  }
  const apiKey = process.env.JOTFORM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'JotForm API ist nicht konfiguriert (JOTFORM_API_KEY fehlt)' }, { status: 503 })
  }
  let questions: Record<string, { text?: string; type?: string; order?: string; required?: string }>
  try {
    const res = await fetch(`https://api.jotform.com/form/${formId}/questions?apiKey=${apiKey}`)
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ error: 'JotForm API Fehler: ' + (t || res.statusText) }, { status: 502 })
    }
    const data = await res.json()
    if (data.responseCode !== 200 || !data.content) {
      return NextResponse.json({ error: 'JotForm: Keine Fragen gefunden' }, { status: 404 })
    }
    questions = data.content
  } catch (e) {
    console.error('JotForm import error:', e)
    return NextResponse.json({ error: 'JotForm API nicht erreichbar' }, { status: 502 })
  }
  const form = await prisma.jotFormForm.upsert({
    where: { projectId_formType: { projectId, formType } },
    create: { projectId, formType, jotformFormId: formId, jotformUrl, importedAt: new Date(), importedByUserId: userId },
    update: { jotformFormId: formId, jotformUrl, importedAt: new Date(), importedByUserId: userId },
  })
  await prisma.jotFormFormField.deleteMany({ where: { jotFormFormId: form.id } })
  const entries = Object.entries(questions).filter(([, q]) => q && typeof q === 'object' && (q.text || q.type))
  let order = 0
  for (const [qid, q] of entries) {
    const text = (q.text ?? '').trim() || `Frage ${qid}`
    const type = (q.type ?? 'text').toString()
    const required = q.required === 'Yes' || q.required === '1'
    await prisma.jotFormFormField.create({
      data: {
        jotFormFormId: form.id,
        jotformQuestionId: qid,
        label: text,
        type,
        order: order++,
        required,
      },
    })
  }
  const updated = await prisma.jotFormForm.findUnique({
    where: { id: form.id },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(updated)
}
