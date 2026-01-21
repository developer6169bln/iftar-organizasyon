import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { jwtVerify } from 'jose'

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
  title: z.string().optional().nullable(),
  content: z.string().min(1),
})

const updateSchema = z.object({
  id: z.string(),
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

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const category = searchParams.get('category')
    const taskId = searchParams.get('taskId')
    const scope = searchParams.get('scope') // "category" => taskId NULL

    const where: any = {}
    if (eventId) where.eventId = eventId
    if (category) where.category = category
    if (taskId) where.taskId = taskId
    if (scope === 'category') where.taskId = null

    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ notes })
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

    const authorId = (await getUserIdFromRequest(request)) || 'unknown'
    const title = (data.title && data.title.trim()) || 'Notiz'

    const note = await prisma.note.create({
      data: {
        eventId: data.eventId || null,
        taskId: data.taskId || null,
        category: data.category || null,
        title,
        content: data.content,
        authorId,
      },
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

    const updateData: any = {}
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

