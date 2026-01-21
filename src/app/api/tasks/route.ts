import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logCreate, logUpdate, logDelete, logView, getUserIdFromRequest } from '@/lib/auditLog'

async function getTableColumns(tableName: string): Promise<Set<string>> {
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

const taskSchema = z.object({
  eventId: z.string(),
  category: z.string(),
  title: z.string().min(1),
  // allow null/empty string from clients; normalize later
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const eventId = searchParams.get('eventId')

    const where: any = {}
    if (category) {
      where.category = category
    }
    if (eventId) {
      where.eventId = eventId
    }

    const cols = await getTableColumns('tasks')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasPriority = cols.has('priority')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')

    const includeAttachments = await tableExists('attachments')
    const includeAssignments = await tableExists('task_assignments')

    // Build select dynamically so Prisma won't reference missing columns.
    // NOTE: If your DB schema is behind, we only select what exists.
    const baseSelect: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      ...(hasDescription ? { description: true } : {}),
      ...(hasStatus ? { status: true } : {}),
      ...(hasPriority ? { priority: true } : {}),
      ...(hasDueDate ? { dueDate: true } : {}),
      ...(hasCompletedAt ? { completedAt: true } : {}),
      ...(hasCreatedAt ? { createdAt: true } : {}),
      ...(hasUpdatedAt ? { updatedAt: true } : {}),
    }

    if (hasAssignedToColumn) {
      baseSelect.assignedTo = true
      // assignedUser relation only safe if column exists
      baseSelect.assignedUser = { select: { id: true, name: true, email: true } }
    }

    if (includeAssignments) {
      baseSelect.assignments = {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }
    }

    if (includeAttachments) {
      baseSelect.attachments = { orderBy: { createdAt: 'desc' as const } }
    }

    const tasks = await prisma.task.findMany({
      where,
      select: baseSelect,
      orderBy: {
        ...(hasCreatedAt ? { createdAt: 'desc' as const } : { id: 'desc' as const }),
      },
    })

    // Füge leere Arrays hinzu, falls nicht vorhanden
    const tasksWithDefaults = tasks.map((task: any) => ({
      ...task,
      attachments: task.attachments || [],
      assignments: task.assignments || [],
      description: task.description ?? null,
      status: task.status ?? 'PENDING',
      priority: task.priority ?? 'MEDIUM',
      dueDate: task.dueDate ?? null,
      completedAt: task.completedAt ?? null,
      createdAt: task.createdAt ?? null,
      updatedAt: task.updatedAt ?? null,
      assignedTo: task.assignedTo ?? null,
    }))

    return NextResponse.json(tasksWithDefaults)
  } catch (error) {
    console.error('Tasks fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Görevler yüklenirken hata oluştu',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = taskSchema.parse(body)

    const cols = await getTableColumns('tasks')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasPriority = cols.has('priority')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')

    const includeAssignments = await tableExists('task_assignments')

    const normalizedDescription =
      validatedData.description === null || validatedData.description === ''
        ? null
        : validatedData.description

    const selectOptions: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      ...(hasDescription ? { description: true } : {}),
      ...(hasStatus ? { status: true } : {}),
      ...(hasPriority ? { priority: true } : {}),
      ...(hasDueDate ? { dueDate: true } : {}),
      ...(hasCompletedAt ? { completedAt: true } : {}),
      ...(hasCreatedAt ? { createdAt: true } : {}),
      ...(hasUpdatedAt ? { updatedAt: true } : {}),
      ...(includeAssignments
        ? {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          }
        : {}),
      ...(hasAssignedToColumn
        ? {
            assignedTo: true,
            assignedUser: { select: { id: true, name: true, email: true } },
          }
        : {}),
    }

    // Hole User-Info für Logging
    const userInfo = await getUserIdFromRequest(request)

    const task = await prisma.task.create({
      data: {
        eventId: validatedData.eventId,
        category: validatedData.category,
        title: validatedData.title,
        ...(hasDescription ? { description: normalizedDescription } : {}),
        ...(hasStatus ? { status: validatedData.status || 'PENDING' } : {}),
        ...(hasPriority ? { priority: validatedData.priority || 'MEDIUM' } : {}),
        ...(hasDueDate ? { dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined } : {}),
        ...(hasAssignedToColumn
          ? { assignedTo: validatedData.assignedTo || undefined }
          : {}),
      },
      select: selectOptions,
    })

    return NextResponse.json(
      {
        ...task,
        assignments: (task as any).assignments || [],
        description: (task as any).description ?? null,
        status: (task as any).status ?? 'PENDING',
        priority: (task as any).priority ?? 'MEDIUM',
        dueDate: (task as any).dueDate ?? null,
        completedAt: (task as any).completedAt ?? null,
        createdAt: (task as any).createdAt ?? null,
        updatedAt: (task as any).updatedAt ?? null,
        assignedTo: (task as any).assignedTo ?? null,
        warning: !hasDescription
          ? 'DB-Schema ist veraltet: Spalte tasks.description fehlt, Notizen können nicht gespeichert werden.'
          : null,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('Task creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Görev oluşturulurken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }

    // Hole alten Task für Logging
    const oldTask = await prisma.task.findUnique({
      where: { id },
    })

    if (!oldTask) {
      return NextResponse.json(
        { error: 'Task nicht gefunden' },
        { status: 404 }
      )
    }

    const cols = await getTableColumns('tasks')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasPriority = cols.has('priority')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')

    const dataToUpdate: any = {}
    
    if (updateData.title !== undefined) dataToUpdate.title = updateData.title
    if (hasDescription && updateData.description !== undefined) {
      dataToUpdate.description = updateData.description === '' ? null : (updateData.description ?? null)
    }
    if (hasStatus && updateData.status !== undefined) {
      dataToUpdate.status = updateData.status
      if (updateData.status === 'COMPLETED' && hasCompletedAt) {
        dataToUpdate.completedAt = new Date()
      }
    }
    if (hasPriority && updateData.priority !== undefined) dataToUpdate.priority = updateData.priority
    if (hasDueDate && updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate && updateData.dueDate !== '' 
        ? new Date(updateData.dueDate) 
        : null
    }
    if (hasAssignedToColumn && updateData.assignedTo !== undefined) {
      dataToUpdate.assignedTo =
        updateData.assignedTo && updateData.assignedTo !== '' ? updateData.assignedTo : null
    }

    // Hole User-Info für Logging
    const userInfo = await getUserIdFromRequest(request)

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        eventId: true,
        category: true,
        title: true,
        ...(hasDescription ? { description: true } : {}),
        ...(hasStatus ? { status: true } : {}),
        ...(hasPriority ? { priority: true } : {}),
        ...(hasDueDate ? { dueDate: true } : {}),
        ...(hasCompletedAt ? { completedAt: true } : {}),
        ...(hasCreatedAt ? { createdAt: true } : {}),
        ...(hasUpdatedAt ? { updatedAt: true } : {}),
        ...(hasAssignedToColumn
          ? {
              assignedTo: true,
              assignedUser: { select: { id: true, name: true, email: true } },
            }
          : {}),
      },
    })

    return NextResponse.json({
      ...task,
      description: (task as any).description ?? null,
      status: (task as any).status ?? 'PENDING',
      priority: (task as any).priority ?? 'MEDIUM',
      dueDate: (task as any).dueDate ?? null,
      completedAt: (task as any).completedAt ?? null,
      createdAt: (task as any).createdAt ?? null,
      updatedAt: (task as any).updatedAt ?? null,
      assignedTo: (task as any).assignedTo ?? null,
      warning: !hasDescription
        ? 'DB-Schema ist veraltet: Spalte tasks.description fehlt, Notizen können nicht gespeichert werden.'
        : null,
    })
  } catch (error) {
    console.error('Task update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Görev güncellenirken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }

    // Prüfe ob Task existiert
    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task nicht gefunden' },
        { status: 404 }
      )
    }

    await prisma.task.delete({
      where: { id },
    })

    // Log delete
    const userInfo = await getUserIdFromRequest(request)
    await logDelete('TASK', id, task, request, {
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      eventId: task.eventId,
      category: task.category,
      description: `Aufgabe "${task.title}" gelöscht`,
    })

    return NextResponse.json({ message: 'Görev silindi' })
  } catch (error) {
    console.error('Task deletion error:', error)
    return NextResponse.json(
      { error: 'Görev silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
