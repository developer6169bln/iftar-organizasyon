import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { loadUnicodeFontForPdf, pdfSafeTextForUnicode } from '@/lib/pdfUnicodeFont'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

// Prisma + PDF generation require Node.js runtime (not Edge).
export const runtime = 'nodejs'

type TaskRow = {
  id: string
  eventId: string
  category: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  assignedTo: string | null
  assignedUser?: { id: string; name: string; email: string } | null
}

type ChecklistRow = {
  id: string
  eventId: string | null
  category: string
  title: string
  description: string | null
  status: string
  dueDate: Date | null
}

type NoteRow = {
  id: string
  eventId: string | null
  taskId: string | null
  category: string | null
  title: string
  content: string
  authorId: string
  updatedAt: Date
}

type GuestRow = {
  id: string
  eventId: string
  name: string
  title: string | null
  organization: string | null
  phone: string | null
  tableNumber: number | null
  isVip: boolean
  needsSpecialReception: boolean
  receptionBy: string | null
  arrivalDate: Date | null
  arrivalTime: Date | null
  notes: string | null
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `
    return rows[0]?.exists === true
  } catch {
    return false
  }
}

async function getColumns(tableName: string): Promise<Set<string>> {
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    `
    return new Set((rows || []).map((r) => r.column_name))
  } catch {
    return new Set()
  }
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('de-DE')
  } catch {
    return ''
  }
}

function groupBy<T>(rows: T[], keyFn: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) {
    const k = keyFn(r) || 'Unbekannt'
    out[k] = out[k] || []
    out[k].push(r)
  }
  return out
}

function wrapText(text: string, maxChars: number): string[] {
  const t = pdfSafeTextForUnicode(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ['']
  const words = t.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= maxChars) {
      line = next
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

async function buildPdf(args: {
  title: string
  subtitle?: string
  sections: Array<{
    heading: string
    table?: { headers: string[]; rows: string[][]; doneColumn?: boolean }
    paragraphs?: string[]
  }>
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const unicodeFont = await loadUnicodeFontForPdf(pdfDoc)
  const font = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const fontBold = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))

  const pageSize: [number, number] = [595.28, 841.89] // A4
  let page = pdfDoc.addPage(pageSize)
  let y = pageSize[1] - 50
  const marginX = 40

  const drawText = (txt: string, size: number, bold = false) => {
    page.drawText(pdfSafeTextForUnicode(txt), {
      x: marginX,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    })
    y -= size + 6
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < 50) {
      page = pdfDoc.addPage(pageSize)
      y = pageSize[1] - 50
    }
  }

  // Title
  drawText(args.title, 18, true)
  if (args.subtitle) drawText(args.subtitle, 11, false)
  y -= 6

  const drawTable = (headers: string[], rows: string[][]) => {
    const colWidths = (() => {
      // Simple widths; last column reserved for checkbox when header is "Erledigt"
      const total = pageSize[0] - marginX * 2
      if (headers.length === 6 && headers[headers.length - 1] === 'Erledigt') {
        return [150, 170, 70, 60, 65, total - (150 + 170 + 70 + 60 + 65)]
      }
      // Distribute with preference to first two columns
      if (headers.length === 5) return [170, 210, 70, 60, total - (170 + 210 + 70 + 60)]
      const base = total / headers.length
      return Array(headers.length).fill(base)
    })()

    const rowHeightBase = 14

    const drawRowBorder = (rowY: number, height: number) => {
      page.drawRectangle({
        x: marginX,
        y: rowY - height,
        width: pageSize[0] - marginX * 2,
        height,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      })
    }

    const drawHeader = () => {
      ensureSpace(30)
      const height = 18
      page.drawRectangle({
        x: marginX,
        y: y - height,
        width: pageSize[0] - marginX * 2,
        height,
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1,
        color: rgb(0.95, 0.95, 0.95),
      })
      let x = marginX + 6
      for (let i = 0; i < headers.length; i++) {
        const h = pdfSafeTextForUnicode(headers[i])
        page.drawText(h, { x, y: y - 13, size: 9, font: fontBold, color: rgb(0, 0, 0) })
        x += colWidths[i]
      }
      y -= height + 2
    }

    drawHeader()

    for (const r of rows) {
      // wrap first two columns
      const cellLines = r.map((c, idx) => {
        if (idx === 0) return wrapText(c || '', 28)
        if (idx === 1) return wrapText(c || '', 38)
        return wrapText(c || '', 18)
      })
      const maxLines = Math.max(...cellLines.map((l) => l.length))
      const height = Math.max(rowHeightBase, maxLines * 11 + 6)
      ensureSpace(height + 10)

      drawRowBorder(y, height)

      let x = marginX + 6
      for (let i = 0; i < r.length; i++) {
        const lines = cellLines[i]
        // Special checkbox if last column header is "Erledigt"
        if (headers[i] === 'Erledigt') {
          // draw empty square
          const boxSize = 10
          const boxX = x + 2
          const boxY = y - height / 2 - boxSize / 2 + 2
          page.drawRectangle({
            x: boxX,
            y: boxY,
            width: boxSize,
            height: boxSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          })
          x += colWidths[i]
          continue
        }

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li]
          page.drawText(pdfSafeTextForUnicode(line), {
            x,
            y: y - 12 - li * 11,
            size: 9,
            font,
            color: rgb(0, 0, 0),
            maxWidth: colWidths[i] - 8,
          })
        }
        x += colWidths[i]
      }
      y -= height + 2
    }
  }

  for (const s of args.sections) {
    ensureSpace(28)
    drawText(s.heading, 13, true)
    if (s.paragraphs) {
      for (const p of s.paragraphs) {
        ensureSpace(18)
        const lines = wrapText(p, 110)
        for (const l of lines) {
          page.drawText(pdfSafeTextForUnicode(l), { x: marginX, y, size: 10, font, color: rgb(0, 0, 0) })
          y -= 14
        }
      }
      y -= 6
    }
    if (s.table) {
      drawTable(s.table.headers, s.table.rows)
      y -= 8
    }
  }

  return await pdfDoc.save()
}

function pdfDownloadResponse(bytes: Uint8Array, filename: string) {
  // NextResponse expects BodyInit; Buffer works in Node runtime.
  const body = Buffer.from(bytes)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'reports')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all_by_user'
    const eventId = searchParams.get('eventId')
    const userId = searchParams.get('userId')
    const categoryId = searchParams.get('categoryId')
    const responsibleUserId = searchParams.get('responsibleUserId')

    if (!eventId) {
      return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    // Load event (best effort)
    const event = await prisma.event.findUnique({ where: { id: eventId } }).catch(() => null)

    // Schema checks
    const taskCols = await getColumns('tasks')
    const checklistCols = await getColumns('checklist_items')
    const guestCols = await getColumns('guests')
    const hasAssignedTo = taskCols.has('assignedTo') || taskCols.has('assignedto')
    const hasTaskCreatedAt = taskCols.has('createdAt') || taskCols.has('createdat')
    const hasTaskDescription = taskCols.has('description')
    const hasTaskStatus = taskCols.has('status')
    const hasTaskPriority = taskCols.has('priority')
    const hasTaskDueDate = taskCols.has('dueDate') || taskCols.has('duedate')

    const hasChecklistCreatedAt = checklistCols.has('createdAt') || checklistCols.has('createdat')
    const hasChecklistDescription = checklistCols.has('description')
    const hasChecklistStatus = checklistCols.has('status')
    const hasChecklistDueDate = checklistCols.has('dueDate') || checklistCols.has('duedate')

    const hasTaskAssignments = await tableExists('task_assignments')
    const hasCategories = await tableExists('categories')
    const hasNotes = await tableExists('notes')
    const hasGuests = await tableExists('guests')

    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } }).catch(() => [])
    const userById = new Map(users.map((u) => [u.id, u]))

    const categories = hasCategories
      ? await prisma.category
          .findMany({
            select: { categoryId: true, name: true, responsibleUserId: true },
            orderBy: { order: 'asc' },
          })
          .catch(async () => {
            // fallback if "order" column doesn't exist yet
            return prisma.category
              .findMany({ select: { categoryId: true, name: true, responsibleUserId: true } })
              .catch(() => [])
          })
      : []
    const categoryNameById = new Map(categories.map((c) => [c.categoryId, c.name]))

    // Tasks base selection (avoid schema mismatch)
    const taskSelect: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      ...(hasTaskDescription ? { description: true } : {}),
      ...(hasTaskStatus ? { status: true } : {}),
      ...(hasTaskPriority ? { priority: true } : {}),
      ...(hasTaskDueDate ? { dueDate: true } : {}),
      ...(hasAssignedTo ? { assignedTo: true } : {}),
    }

    const checklistSelect: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      ...(hasChecklistDescription ? { description: true } : {}),
      ...(hasChecklistStatus ? { status: true } : {}),
      ...(hasChecklistDueDate ? { dueDate: true } : {}),
    }

    const tasks: TaskRow[] = (await prisma.task
      .findMany({
        where: { eventId, ...(categoryId ? { category: categoryId } : {}) },
        select: taskSelect,
        orderBy: hasTaskCreatedAt ? ({ createdAt: 'desc' as any } as any) : ({ id: 'desc' } as any),
      })
      .catch(() => [])) as any

    // Normalize missing fields (when DB columns are missing)
    for (const t of tasks as any[]) {
      t.description = (t as any).description ?? null
      t.status = (t as any).status ?? 'PENDING'
      t.priority = (t as any).priority ?? 'MEDIUM'
      t.dueDate = (t as any).dueDate ?? null
      t.assignedTo = (t as any).assignedTo ?? null
    }

    // map assignedUser if possible
    if (hasAssignedTo) {
      for (const t of tasks) {
        const u = t.assignedTo ? userById.get(t.assignedTo) : null
        t.assignedUser = u ? { id: u.id, name: u.name, email: u.email } : null
      }
    }

    const checklist: ChecklistRow[] = (await prisma.checklistItem
      .findMany({
        where: { eventId, ...(categoryId ? { category: categoryId } : {}) },
        select: checklistSelect,
        orderBy: hasChecklistCreatedAt ? ({ createdAt: 'desc' as any } as any) : ({ id: 'desc' } as any),
      })
      .catch(() => [])) as any

    for (const c of checklist as any[]) {
      c.description = (c as any).description ?? null
      c.status = (c as any).status ?? 'NOT_STARTED'
      c.dueDate = (c as any).dueDate ?? null
    }

    const notes: NoteRow[] =
      hasNotes
        ? ((await prisma.note
            .findMany({
              where: {
                eventId,
                ...(categoryId ? { category: categoryId } : {}),
              },
              orderBy: { updatedAt: 'desc' },
            })
            .catch(() => [])) as any)
        : []

    // Guests (schema tolerant)
    const guests: GuestRow[] =
      hasGuests
        ? ((await prisma.guest
            .findMany({
              where: { eventId },
              select: {
                id: true,
                eventId: true,
                ...(guestCols.has('name') ? { name: true } : {}),
                ...(guestCols.has('title') ? { title: true } : {}),
                ...(guestCols.has('organization') ? { organization: true } : {}),
                ...(guestCols.has('phone') ? { phone: true } : {}),
                ...(guestCols.has('tableNumber') || guestCols.has('tablenumber') ? { tableNumber: true } : {}),
                ...(guestCols.has('isVip') || guestCols.has('isvip') ? { isVip: true } : {}),
                ...(guestCols.has('needsSpecialReception') || guestCols.has('needsspecialreception')
                  ? { needsSpecialReception: true }
                  : {}),
                ...(guestCols.has('receptionBy') || guestCols.has('receptionby') ? { receptionBy: true } : {}),
                ...(guestCols.has('arrivalDate') || guestCols.has('arrivaldate') ? { arrivalDate: true } : {}),
                ...(guestCols.has('arrivalTime') || guestCols.has('arrivaltime') ? { arrivalTime: true } : {}),
                ...(guestCols.has('notes') ? { notes: true } : {}),
              },
              orderBy: guestCols.has('name') ? ({ name: 'asc' as any } as any) : ({ id: 'asc' } as any),
            })
            .catch(async () => {
              // fallback if orderBy column mismatch
              return prisma.guest
                .findMany({
                  where: { eventId },
                  orderBy: { id: 'asc' },
                })
                .catch(() => [])
            })) as any)
        : []

    for (const g of guests as any[]) {
      g.name = (g as any).name ?? ''
      g.title = (g as any).title ?? null
      g.organization = (g as any).organization ?? null
      g.phone = (g as any).phone ?? null
      g.tableNumber = (g as any).tableNumber ?? null
      g.isVip = (g as any).isVip ?? false
      g.needsSpecialReception = (g as any).needsSpecialReception ?? false
      g.receptionBy = (g as any).receptionBy ?? null
      g.arrivalDate = (g as any).arrivalDate ?? null
      g.arrivalTime = (g as any).arrivalTime ?? null
      g.notes = (g as any).notes ?? null
    }

    const baseSubtitle = `${event?.title || 'Event'} — ${event?.date ? new Date(event.date).toLocaleDateString('de-DE') : ''}`

    const guestSections = (() => {
      if (!hasGuests) return []
      const allRows = guests.map((g) => [
        g.name || '',
        [g.title, g.organization].filter(Boolean).join(' / '),
        g.phone || '',
        g.tableNumber !== null && g.tableNumber !== undefined ? String(g.tableNumber) : '',
        [
          g.needsSpecialReception ? `Empfang: ${g.receptionBy || 'Ja'}` : '',
          g.arrivalDate ? `Anreise: ${formatDate(g.arrivalDate)}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      ])
      const vipRows = guests
        .filter((g) => g.isVip)
        .map((g) => [
          g.name || '',
          [g.title, g.organization].filter(Boolean).join(' / '),
          g.phone || '',
          g.tableNumber !== null && g.tableNumber !== undefined ? String(g.tableNumber) : '',
          g.notes || '',
        ])

      return [
        {
          heading: `Gästeliste (gesamt) (${allRows.length})`,
          table: { headers: ['Name', 'Titel/Org.', 'Telefon', 'Tisch', 'Details'], rows: allRows },
        },
        {
          heading: `Gästeliste (VIP) (${vipRows.length})`,
          table: { headers: ['Name', 'Titel/Org.', 'Telefon', 'Tisch', 'Notizen'], rows: vipRows },
        },
      ]
    })()

    // Build report sections
    if (type === 'all_by_user') {
      const groupKey = (t: TaskRow) => t.assignedUser?.name || 'Nicht zugewiesen'
      const grouped = groupBy(tasks, groupKey)
      const sections = Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => {
          const rows = grouped[name].map((t) => [
            t.title,
            t.description || '',
            categoryNameById.get(t.category) || t.category,
            formatDate(t.dueDate),
            t.priority,
            ' ', // checkbox
          ])
          return {
            heading: `Benutzer: ${name} (${rows.length})`,
            table: {
              headers: ['Aufgabe', 'Notiz', 'Bereich', 'Fällig', 'Prio', 'Erledigt'],
              rows,
            },
          }
        })
        .concat(guestSections as any)

      const pdf = await buildPdf({
        title: 'Bericht: Alle Aufgaben (gruppiert nach Benutzer)',
        subtitle: baseSubtitle,
        sections,
      })

      return pdfDownloadResponse(pdf, 'berichte-alle-aufgaben.pdf')
    }

    if (type === 'user') {
      if (!userId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

      let userTasks: TaskRow[] = []
      if (hasAssignedTo) {
        userTasks = tasks.filter((t) => t.assignedTo === userId)
      } else if (hasTaskAssignments) {
        // fallback via task_assignments
        const taskIds = await prisma.taskAssignment
          .findMany({ where: { userId }, select: { taskId: true } })
          .then((r) => r.map((x) => x.taskId))
          .catch(() => [])
        const idSet = new Set(taskIds)
        userTasks = tasks.filter((t) => idSet.has(t.id))
      } else {
        userTasks = []
      }

      const u = userById.get(userId)
      const rows = userTasks.map((t) => [
        t.title,
        t.description || '',
        categoryNameById.get(t.category) || t.category,
        formatDate(t.dueDate),
        t.priority,
        ' ',
      ])

      const pdf = await buildPdf({
        title: `Bericht: Aufgaben von ${u?.name || 'Benutzer'}`,
        subtitle: baseSubtitle,
        sections: [
          {
            heading: 'Aufgaben',
            table: { headers: ['Aufgabe', 'Notiz', 'Bereich', 'Fällig', 'Prio', 'Erledigt'], rows },
            paragraphs:
              !hasAssignedTo && !hasTaskAssignments
                ? ['Hinweis: Die Datenbank hat keine Zuweisungs-Spalten/Tabelle. Es können keine Aufgaben pro Benutzer gefiltert werden.']
                : undefined,
          },
          ...(guestSections as any),
        ],
      })

      return pdfDownloadResponse(pdf, 'berichte-benutzer-aufgaben.pdf')
    }

    if (type === 'category') {
      if (!categoryId) return NextResponse.json({ error: 'categoryId fehlt' }, { status: 400 })
      const catName = categoryNameById.get(categoryId) || categoryId

      const taskRows = tasks
        .filter((t) => t.category === categoryId)
        .map((t) => [t.title, t.description || '', t.status, formatDate(t.dueDate), t.priority, ' '])
      const checklistRows = checklist
        .filter((c) => c.category === categoryId)
        .map((c) => [c.title, c.description || '', c.status, formatDate(c.dueDate), ' '])
      const noteRows = hasNotes
        ? notes
            .filter((n) => n.category === categoryId)
            .map((n) => `- ${n.title}: ${n.content}`)
        : []

      const pdf = await buildPdf({
        title: `Bericht: Bereich ${catName}`,
        subtitle: baseSubtitle,
        sections: [
          {
            heading: 'Aufgaben',
            table: { headers: ['Aufgabe', 'Notiz', 'Status', 'Fällig', 'Prio', 'Erledigt'], rows: taskRows },
          },
          {
            heading: 'Checkliste',
            table: { headers: ['Punkt', 'Notiz', 'Status', 'Fällig', 'Erledigt'], rows: checklistRows },
          },
          ...(noteRows.length
            ? [{ heading: 'Notizen', paragraphs: noteRows }]
            : []),
          ...(guestSections as any),
        ],
      })

      return pdfDownloadResponse(pdf, `berichte-bereich-${categoryId}.pdf`)
    }

    if (type === 'responsible') {
      if (!responsibleUserId) return NextResponse.json({ error: 'responsibleUserId fehlt' }, { status: 400 })
      if (!hasCategories) {
        return NextResponse.json({ error: 'categories Tabelle fehlt in der DB' }, { status: 500 })
      }

      const u = userById.get(responsibleUserId)
      const responsibleCats = categories.filter((c) => c.responsibleUserId === responsibleUserId)
      const sections: any[] = []

      for (const c of responsibleCats) {
        const catId = c.categoryId
        const catName = c.name
        const taskRows = tasks
          .filter((t) => t.category === catId)
          .map((t) => [t.title, t.description || '', t.status, formatDate(t.dueDate), t.priority, ' '])
        const checklistRows = checklist
          .filter((x) => x.category === catId)
          .map((x) => [x.title, x.description || '', x.status, formatDate(x.dueDate), ' '])
        const noteRows = hasNotes
          ? notes.filter((n) => n.category === catId).map((n) => `- ${n.title}: ${n.content}`)
          : []

        sections.push({
          heading: `Bereich: ${catName}`,
          table: { headers: ['Aufgabe', 'Notiz', 'Status', 'Fällig', 'Prio', 'Erledigt'], rows: taskRows },
        })
        sections.push({
          heading: `Checkliste: ${catName}`,
          table: { headers: ['Punkt', 'Notiz', 'Status', 'Fällig', 'Erledigt'], rows: checklistRows },
        })
        if (noteRows.length) {
          sections.push({ heading: `Notizen: ${catName}`, paragraphs: noteRows })
        }
      }

      const pdf = await buildPdf({
        title: `Bericht: Hauptverantwortlicher — ${u?.name || 'Benutzer'}`,
        subtitle: baseSubtitle,
        sections: (sections.length ? sections : [{ heading: 'Hinweis', paragraphs: ['Keine Bereiche zugeordnet.'] }]).concat(
          guestSections as any
        ),
      })

      return pdfDownloadResponse(pdf, 'berichte-hauptverantwortlicher.pdf')
    }

    return NextResponse.json({ error: 'Unbekannter Report-Typ' }, { status: 400 })
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json(
      { error: 'Bericht konnte nicht erstellt werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

