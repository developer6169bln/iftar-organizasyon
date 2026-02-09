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

/** Öffentliche JotForm-Seite abrufen und Formular-Felder aus dem HTML auslesen (ohne API). */
async function fetchFormFieldsFromHtml(jotformUrl: string): Promise<{ submitUrl: string; fields: { name: string; type: string; label: string; required: boolean }[] }> {
  const res = await fetch(jotformUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Formular-Seite nicht erreichbar: ${res.status}`)
  }
  const html = await res.text()

  // Form-Action-URL (JotForm Submit-Endpoint)
  const formActionMatch = html.match(/<form[^>]*\s+action=["']([^"']+)["']/i) || html.match(/form\.action\s*=\s*["']([^"']+)["']/i)
  const formId = getJotformFormIdFromUrl(jotformUrl)
  const submitUrl = formActionMatch?.[1]?.trim() || (formId ? `https://submit.jotform.com/submit/${formId}` : '')

  if (!submitUrl) {
    throw new Error('Submit-URL des Formulars konnte nicht ermittelt werden')
  }

  const fields: { name: string; type: string; label: string; required: boolean }[] = []
  const seenNames = new Set<string>()

  // Input-Felder: name, type; Label aus vorherigem <label> oder name
  const inputRegex = /<input[^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = inputRegex.exec(html)) !== null) {
    const fullTag = m[0]
    const name = m[1].trim()
    if (seenNames.has(name) || name.startsWith('_') || name === 'formID' || name === 'formID[]') continue
    seenNames.add(name)
    const typeMatch = fullTag.match(/\s+type=["']([^"']+)["']/i)
    let type = (typeMatch?.[1] || 'text').toLowerCase()
    if (type === 'hidden' || type === 'submit' || type === 'button') continue
    if (type === 'radio' || type === 'checkbox') type = 'text'
    const required = /\s+required\s/i.test(fullTag) || /required=["']/i.test(fullTag)
    const labelMatch = fullTag.match(/\s+aria-label=["']([^"']+)["']/i) || fullTag.match(/\s+title=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    fields.push({ name, type, label, required })
  }

  // Textareas
  const textareaRegex = /<textarea[^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  while ((m = textareaRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (seenNames.has(name)) continue
    seenNames.add(name)
    const fullTag = m[0]
    const required = /\s+required\s/i.test(fullTag)
    const labelMatch = fullTag.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    fields.push({ name, type: 'textarea', label, required })
  }

  // Selects
  const selectRegex = /<select[^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  while ((m = selectRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (seenNames.has(name)) continue
    seenNames.add(name)
    const fullTag = m[0]
    const required = /\s+required\s/i.test(fullTag)
    const labelMatch = fullTag.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    fields.push({ name, type: 'dropdown', label, required })
  }

  // Sort: typische JotForm-Namen q1, q2, ... sortieren
  fields.sort((a, b) => {
    const aNum = parseInt(a.name.replace(/\D/g, ''), 10) || 0
    const bNum = parseInt(b.name.replace(/\D/g, ''), 10) || 0
    return aNum - bNum || a.name.localeCompare(b.name)
  })

  return { submitUrl, fields }
}

const importSchema = z.object({
  projectId: z.string(),
  formType: z.enum(FORM_TYPES),
  jotformUrl: z.string().url(),
})

/**
 * Felder aus öffentlicher JotForm-URL importieren (ohne API).
 * Liest die Formular-Seite aus und erstellt daraus die Eingabefelder.
 * Projekt-Inhaber oder Admin.
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

  let fields: { name: string; type: string; label: string; required: boolean }[]
  try {
    const parsedForm = await fetchFormFieldsFromHtml(jotformUrl)
    fields = parsedForm.fields
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Formular konnte nicht gelesen werden'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Im Formular wurden keine Felder gefunden. Bitte prüfen Sie die URL (öffentliches JotForm-Formular).' }, { status: 404 })
  }

  const form = await prisma.jotFormForm.upsert({
    where: { projectId_formType: { projectId, formType } },
    create: { projectId, formType, jotformFormId: formId, jotformUrl, importedAt: new Date(), importedByUserId: userId },
    update: { jotformFormId: formId, jotformUrl, importedAt: new Date(), importedByUserId: userId },
  })
  await prisma.jotFormFormField.deleteMany({ where: { jotFormFormId: form.id } })
  let order = 0
  for (const f of fields) {
    await prisma.jotFormFormField.create({
      data: {
        jotFormFormId: form.id,
        jotformQuestionId: f.name,
        label: f.label,
        type: f.type,
        order: order++,
        required: f.required,
      },
    })
  }
  const updated = await prisma.jotFormForm.findUnique({
    where: { id: form.id },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(updated)
}
