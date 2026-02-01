import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { jwtVerify } from 'jose'
import { requireEventAccess } from '@/lib/permissions'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production')

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

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  // Cookie: auth-token
  const cookieToken = request.cookies.get('auth-token')?.value || null

  const token = bearer || cookieToken
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    const userId = (payload as any)?.userId
    return typeof userId === 'string' ? userId : null
  } catch {
    return null
  }
}

const createSchema = z.object({
  eventId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  participantsUserIds: z.array(z.string()).optional().nullable(),
  calledWithUserId: z.string().optional().nullable(),
  calledWithText: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  content: z.string().min(1),
})

const updateSchema = z.object({
  id: z.string(),
  type: z.string().optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  participantsUserIds: z.array(z.string()).optional().nullable(),
  calledWithUserId: z.string().optional().nullable(),
  calledWithText: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const hasNotesTable = await tableExists('notes')
    if (!hasNotesTable) {
      return NextResponse.json({
        notes: [],
        warning: 'DB-Tabelle "notes" fehlt. Bitte Migration/SQL ausführen, damit Notizen gespeichert werden können.',
      })
    }

    const cols = await getColumns('notes')
    const select: any = {
      id: true,
      ...(cols.has('eventId') || cols.has('eventid') ? { eventId: true } : {}),
      ...(cols.has('taskId') || cols.has('taskid') ? { taskId: true } : {}),
      ...(cols.has('category') ? { category: true } : {}),
      ...(cols.has('type') ? { type: true } : {}),
      ...(cols.has('responsibleUserId') || cols.has('responsibleuserid') ? { responsibleUserId: true } : {}),
      ...(cols.has('participantsUserIds') || cols.has('participantsuserids') ? { participantsUserIds: true } : {}),
      ...(cols.has('calledWithUserId') || cols.has('calledwithuserid') ? { calledWithUserId: true } : {}),
      ...(cols.has('calledWithText') || cols.has('calledwithtext') ? { calledWithText: true } : {}),
      ...(cols.has('title') ? { title: true } : {}),
      ...(cols.has('content') ? { content: true } : {}),
      ...(cols.has('authorId') || cols.has('authorid') ? { authorId: true } : {}),
      ...(cols.has('createdAt') || cols.has('createdat') ? { createdAt: true } : {}),
      ...(cols.has('updatedAt') || cols.has('updatedat') ? { updatedAt: true } : {}),
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const category = searchParams.get('category')
    const taskId = searchParams.get('taskId')
    const scope = searchParams.get('scope') // "category" => taskId NULL
    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }

    const where: any = {}
    if (eventId) where.eventId = eventId
    if (category) where.category = category
    if (taskId) where.taskId = taskId
    if (scope === 'category') where.taskId = null

    const notes = await prisma.note.findMany({
      where,
      select,
      orderBy: cols.has('updatedAt') || cols.has('updatedat') ? ({ updatedAt: 'desc' } as any) : ({ id: 'desc' } as any),
    })

    const normalized = (notes as any[]).map((n) => {
      let participants: string[] = []
      const raw = (n as any).participantsUserIds
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) participants = parsed.filter((x) => typeof x === 'string')
        } catch {
          participants = []
        }
      }
      return {
      id: n.id,
      eventId: n.eventId ?? null,
      taskId: n.taskId ?? null,
      category: n.category ?? null,
      type: n.type ?? null,
      responsibleUserId: (n as any).responsibleUserId ?? null,
      participantsUserIds: participants,
      calledWithUserId: (n as any).calledWithUserId ?? null,
      calledWithText: (n as any).calledWithText ?? null,
      title: n.title ?? 'Notiz',
      content: n.content ?? '',
      authorId: n.authorId ?? 'unknown',
      createdAt: n.createdAt ?? null,
      updatedAt: n.updatedAt ?? null,
      }
    })

    return NextResponse.json({ notes: normalized })
  } catch (error) {
    console.error('Notes fetch error:', error)
    return NextResponse.json(
      { error: 'Notizen konnten nicht geladen werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasNotesTable = await tableExists('notes')
    if (!hasNotesTable) {
      return NextResponse.json(
        { error: 'DB-Tabelle "notes" fehlt. Bitte Migration/SQL ausführen.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const data = createSchema.parse(body)
    const cols = await getColumns('notes')

    const authorId = (await getUserIdFromRequest(request)) || 'unknown'
    const title = (data.title && data.title.trim()) || 'Notiz'

    // Prisma types assume latest schema. We build data dynamically to tolerate DB schema drift.
    const participantsJson =
      data.participantsUserIds && Array.isArray(data.participantsUserIds)
        ? JSON.stringify(data.participantsUserIds.filter((x) => typeof x === 'string'))
        : null

    const createData: any = {
      ...(cols.has('eventId') || cols.has('eventid') ? { eventId: data.eventId || null } : {}),
      ...(cols.has('taskId') || cols.has('taskid') ? { taskId: data.taskId || null } : {}),
      ...(cols.has('category') ? { category: data.category || null } : {}),
      ...(cols.has('type') ? { type: data.type && data.type.trim() ? data.type : null } : {}),
      ...(cols.has('responsibleUserId') || cols.has('responsibleuserid')
        ? { responsibleUserId: data.responsibleUserId && data.responsibleUserId.trim() ? data.responsibleUserId : null }
        : {}),
      ...(cols.has('participantsUserIds') || cols.has('participantsuserids') ? { participantsUserIds: participantsJson } : {}),
      ...(cols.has('calledWithUserId') || cols.has('calledwithuserid')
        ? { calledWithUserId: data.calledWithUserId && data.calledWithUserId.trim() ? data.calledWithUserId : null }
        : {}),
      ...(cols.has('calledWithText') || cols.has('calledwithtext')
        ? { calledWithText: data.calledWithText && data.calledWithText.trim() ? data.calledWithText : null }
        : {}),
      ...(cols.has('title') ? { title } : {}),
      ...(cols.has('content') ? { content: data.content } : {}),
      ...(cols.has('authorId') || cols.has('authorid') ? { authorId } : {}),
    }

    const note = await prisma.note.create({
      data: createData as any,
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }
    console.error('Note create error:', error)
    return NextResponse.json(
      { error: 'Notiz konnte nicht gespeichert werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const hasNotesTable = await tableExists('notes')
    if (!hasNotesTable) {
      return NextResponse.json(
        { error: 'DB-Tabelle "notes" fehlt. Bitte Migration/SQL ausführen.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const data = updateSchema.parse(body)
    const cols = await getColumns('notes')

    const updateData: any = {}
    if (data.type !== undefined && (cols.has('type'))) updateData.type = data.type && data.type.trim() ? data.type : null
    if (data.responsibleUserId !== undefined && (cols.has('responsibleUserId') || cols.has('responsibleuserid'))) {
      updateData.responsibleUserId = data.responsibleUserId && data.responsibleUserId.trim() ? data.responsibleUserId : null
    }
    if (data.participantsUserIds !== undefined && (cols.has('participantsUserIds') || cols.has('participantsuserids'))) {
      updateData.participantsUserIds =
        data.participantsUserIds && Array.isArray(data.participantsUserIds)
          ? JSON.stringify(data.participantsUserIds.filter((x) => typeof x === 'string'))
          : null
    }
    if (data.calledWithUserId !== undefined && (cols.has('calledWithUserId') || cols.has('calledwithuserid'))) {
      updateData.calledWithUserId = data.calledWithUserId && data.calledWithUserId.trim() ? data.calledWithUserId : null
    }
    if (data.calledWithText !== undefined && (cols.has('calledWithText') || cols.has('calledwithtext'))) {
      updateData.calledWithText = data.calledWithText && data.calledWithText.trim() ? data.calledWithText : null
    }
    if (data.title !== undefined) updateData.title = data.title && data.title.trim() ? data.title : 'Notiz'
    if (data.content !== undefined) updateData.content = data.content ?? ''

    const note = await prisma.note.update({
      where: { id: data.id },
      data: updateData,
    })

    return NextResponse.json(note)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }
    console.error('Note update error:', error)
    return NextResponse.json(
      { error: 'Notiz konnte nicht aktualisiert werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hasNotesTable = await tableExists('notes')
    if (!hasNotesTable) {
      return NextResponse.json(
        { error: 'DB-Tabelle "notes" fehlt. Bitte Migration/SQL ausführen.' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
    }

    await prisma.note.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Note delete error:', error)
    return NextResponse.json(
      { error: 'Notiz konnte nicht gelöscht werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

