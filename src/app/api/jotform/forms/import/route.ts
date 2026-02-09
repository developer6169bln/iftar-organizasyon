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

type FieldOption = { value: string; label: string }
type ParsedField = { name: string; type: string; label: string; required: boolean; options?: FieldOption[] }

/** Feld „website“ nicht importieren (oft Honeypot/Spam). */
function isWebsiteField(name: string, label: string): boolean {
  const n = name.toLowerCase().trim()
  const l = label.toLowerCase().trim()
  return n === 'website' || l === 'website' || n.includes('website') && l.includes('website')
}

/** TypA (unter Bölge) als „Sube“ anzeigen. */
function normalizeFieldLabel(label: string): string {
  const t = label.trim().replace(/\s+/g, ' ')
  if (/^Typ\s*A$/i.test(t)) return 'Sube'
  return label
}

/** Optionen aus <option value="x">y</option> oder <option>y</option> innerhalb eines HTML-Blocks */
function parseSelectOptions(selectBlock: string): FieldOption[] {
  const options: FieldOption[] = []
  const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi
  const optionNoValRegex = /<option(?![^>]*\bvalue=)[^>]*>([\s\S]*?)<\/option>/gi
  let om: RegExpExecArray | null
  const seen = new Set<string>()
  while ((om = optionRegex.exec(selectBlock)) !== null) {
    const value = (om[1] ?? '').trim()
    const label = (om[2] ?? '').replace(/<[^>]+>/g, '').trim() || value
    const key = `${value}\t${label}`
    if (!seen.has(key)) {
      seen.add(key)
      options.push({ value, label })
    }
  }
  while ((om = optionNoValRegex.exec(selectBlock)) !== null) {
    const label = (om[1] ?? '').replace(/<[^>]+>/g, '').trim()
    if (!label) continue
    const key = `\t${label}`
    if (!seen.has(key)) {
      seen.add(key)
      options.push({ value: label, label })
    }
  }
  return options
}

/** Öffentliche JotForm-Seite abrufen und Formular-Felder inkl. Optionen (dropdown, radio, checkbox) auslesen. */
async function fetchFormFieldsFromHtml(jotformUrl: string): Promise<{ submitUrl: string; fields: ParsedField[] }> {
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

  const formActionMatch = html.match(/<form[^>]*\s+action=["']([^"']+)["']/i) || html.match(/form\.action\s*=\s*["']([^"']+)["']/i)
  const formId = getJotformFormIdFromUrl(jotformUrl)
  const submitUrl = formActionMatch?.[1]?.trim() || (formId ? `https://submit.jotform.com/submit/${formId}` : '')

  if (!submitUrl) {
    throw new Error('Submit-URL des Formulars konnte nicht ermittelt werden')
  }

  const fields: ParsedField[] = []
  const seenNames = new Set<string>()

  // Select/Dropdown: name + alle <option value="..." >...</option> aus dem Block bis </select>
  const selectBlockRegex = /<select[^>]*\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi
  let m: RegExpExecArray | null
  while ((m = selectBlockRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (name.startsWith('_') || name === 'formID' || name === 'formID[]') continue
    const fullSelect = m[0]
    const inner = m[2] ?? ''
    const required = /\s+required\s/i.test(fullSelect)
    const labelMatch = fullSelect.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    if (isWebsiteField(name, label)) continue
    seenNames.add(name)
    const options = parseSelectOptions(inner)
    fields.push({ name, type: 'dropdown', label, required, options: options.length > 0 ? options : undefined })
  }

  // Radio-Gruppen: alle input type="radio" mit gleichem name → ein Feld mit options (value + label)
  const radioNameToOptions = new Map<string, FieldOption[]>()
  const radioRegex = /<input[^>]*\s+type=["']radio["'][^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  while ((m = radioRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (name.startsWith('_')) continue
    const fullTag = m[0]
    const valueMatch = fullTag.match(/\s+value=["']([^"']*)["']/i)
    const value = (valueMatch?.[1] ?? '').trim()
    const idMatch = fullTag.match(/\s+id=["']([^"']+)["']/i)
    let optionLabel = value
    if (idMatch) {
      const id = idMatch[1]
      const labelForRegex = new RegExp(`<label[^>]*\\s+for=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i')
      const labelMatch = html.match(labelForRegex)
      if (labelMatch) optionLabel = (labelMatch[1] ?? '').replace(/<[^>]+>/g, '').trim() || value
    }
    if (!radioNameToOptions.has(name)) radioNameToOptions.set(name, [])
    const opts = radioNameToOptions.get(name)!
    if (!opts.some((o) => o.value === value)) opts.push({ value, label: optionLabel })
  }
  for (const [name, options] of radioNameToOptions) {
    if (seenNames.has(name)) continue
    const firstInput = html.match(new RegExp(`<input[^>]*type=["']radio["'][^>]*name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i'))?.[0] ?? ''
    const required = /\s+required\s/i.test(firstInput)
    const labelMatch = firstInput.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    if (isWebsiteField(name, label)) continue
    seenNames.add(name)
    fields.push({ name, type: 'radio', label, required, options: options.length > 0 ? options : undefined })
  }

  // Checkbox-Gruppen: input type="checkbox" mit name → options (bei mehreren gleicher name; bei einem oft value="Yes")
  const checkboxNameToOptions = new Map<string, FieldOption[]>()
  const checkboxRegex = /<input[^>]*\s+type=["']checkbox["'][^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  while ((m = checkboxRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (name.startsWith('_')) continue
    const fullTag = m[0]
    const valueMatch = fullTag.match(/\s+value=["']([^"']*)["']/i)
    const value = (valueMatch?.[1] ?? 'Yes').trim() || 'Yes'
    const idMatch = fullTag.match(/\s+id=["']([^"']+)["']/i)
    let optionLabel = value
    if (idMatch) {
      const id = idMatch[1]
      const labelForRegex = new RegExp(`<label[^>]*\\s+for=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i')
      const labelMatch = html.match(labelForRegex)
      if (labelMatch) optionLabel = (labelMatch[1] ?? '').replace(/<[^>]+>/g, '').trim() || value
    }
    if (!checkboxNameToOptions.has(name)) checkboxNameToOptions.set(name, [])
    const opts = checkboxNameToOptions.get(name)!
    if (!opts.some((o) => o.value === value)) opts.push({ value, label: optionLabel })
  }
  for (const [name, options] of checkboxNameToOptions) {
    if (seenNames.has(name)) continue
    const firstInput = html.match(new RegExp(`<input[^>]*type=["']checkbox["'][^>]*name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i'))?.[0] ?? ''
    const required = /\s+required\s/i.test(firstInput)
    const labelMatch = firstInput.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    if (isWebsiteField(name, label)) continue
    seenNames.add(name)
    fields.push({ name, type: 'checkbox', label, required, options: options.length > 0 ? options : undefined })
  }

  // Übrige Inputs (text, email, number, date, datetime-local, time, etc.)
  const inputRegex = /<input[^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  const dateTypeMap: Record<string, string> = { date: 'date', datetime: 'datetime-local', 'datetime-local': 'datetime-local', time: 'time', birthday: 'date' }
  while ((m = inputRegex.exec(html)) !== null) {
    const fullTag = m[0]
    const name = m[1].trim()
    if (seenNames.has(name) || name.startsWith('_') || name === 'formID' || name === 'formID[]') continue
    const typeMatch = fullTag.match(/\s+type=["']([^"']+)["']/i)
    let type = (typeMatch?.[1] || 'text').toLowerCase()
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'radio' || type === 'checkbox') continue
    if (dateTypeMap[type]) type = dateTypeMap[type]
    else if (type === 'text' && (/\bdate\b|calendar|jotform-date|form-date|birthday/i.test(fullTag) || /dd[\s/.-]mm|mm[\s/.-]dd|yyyy|datum|tarih/i.test(fullTag))) type = 'date'
    const required = /\s+required\s/i.test(fullTag) || /required=["']/i.test(fullTag)
    const labelMatch = fullTag.match(/\s+aria-label=["']([^"']+)["']/i) || fullTag.match(/\s+title=["']([^"']+)["']/i)
    let label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    if (isWebsiteField(name, label)) continue
    if (/tarih/i.test(label) || /tarih/i.test(name)) type = 'date'
    seenNames.add(name)
    fields.push({ name, type, label, required })
  }

  // Textareas
  const textareaRegex = /<textarea[^>]*\s+name=["']([^"']+)["'][^>]*>/gi
  while ((m = textareaRegex.exec(html)) !== null) {
    const name = m[1].trim()
    if (seenNames.has(name)) continue
    const fullTag = m[0]
    const required = /\s+required\s/i.test(fullTag)
    const labelMatch = fullTag.match(/\s+aria-label=["']([^"']+)["']/i)
    const label = labelMatch?.[1]?.trim() || name.replace(/^q\d+_?/, '').replace(/[_-]/g, ' ') || name
    if (isWebsiteField(name, label)) continue
    seenNames.add(name)
    fields.push({ name, type: 'textarea', label, required })
  }

  // Sort: typische JotForm-Namen q1, q2, ...
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

  let fields: ParsedField[]
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
    const label = normalizeFieldLabel(f.label)
    await prisma.jotFormFormField.create({
      data: {
        jotFormFormId: form.id,
        jotformQuestionId: f.name,
        label,
        type: f.type,
        order: order++,
        required: f.required,
        options: f.options ? (f.options as object) : undefined,
      },
    })
  }
  const updated = await prisma.jotFormForm.findUnique({
    where: { id: form.id },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(updated)
}
