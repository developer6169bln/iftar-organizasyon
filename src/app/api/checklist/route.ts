import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getProjectIdForEvent, requireCategoryAccess, requireEventAccess } from '@/lib/permissions'

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

const checklistSchema = z.object({
  category: z.string(),
  title: z.string().min(1),
  // allow null/empty string from clients; normalize later
  description: z.string().optional().nullable(),
  eventId: z.string().optional(),
  taskId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const eventId = searchParams.get('eventId')
    let projectId: string | null = null
    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
      projectId = await getProjectIdForEvent(eventId)
    }
    if (category) {
      const access = await requireCategoryAccess(request, category, projectId)
      if (access instanceof NextResponse) return access
    }

    const where: any = {}
    if (category) {
      where.category = category
    }
    if (eventId) {
      where.eventId = eventId
    }

    const cols = await getTableColumns('checklist_items')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')

    const includeAttachments = await tableExists('attachments')

    const selectOptions: any = {
      id: true,
      category: true,
      title: true,
      ...(hasDescription ? { description: true } : {}),
      ...(hasStatus ? { status: true } : {}),
      ...(hasDueDate ? { dueDate: true } : {}),
      ...(hasCompletedAt ? { completedAt: true } : {}),
      ...(hasCreatedAt ? { createdAt: true } : {}),
      ...(hasUpdatedAt ? { updatedAt: true } : {}),
      // relations
      ...(cols.has('eventId') ? { eventId: true } : {}),
      ...(cols.has('taskId') ? { taskId: true } : {}),
      ...(hasAssignedToColumn ? { assignedTo: true } : {}),
      ...(hasAssignedToColumn
        ? { assignedUser: { select: { id: true, name: true, email: true } } }
        : {}),
      ...(includeAttachments ? { attachments: { orderBy: { createdAt: 'desc' as const } } } : {}),
    }

    const items = await prisma.checklistItem.findMany({
      where,
      select: selectOptions,
      orderBy: {
        ...(hasCreatedAt ? { createdAt: 'desc' as const } : { id: 'desc' as const }),
      },
    })

    // Füge leeres attachments Array hinzu, falls nicht vorhanden
    const itemsWithAttachments = items.map((item: any) => ({
      ...item,
      attachments: item.attachments || [],
      description: item.description ?? null,
      status: item.status ?? 'NOT_STARTED',
      dueDate: item.dueDate ?? null,
      completedAt: item.completedAt ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      assignedTo: item.assignedTo ?? null,
    }))

    return NextResponse.json(itemsWithAttachments)
  } catch (error) {
    console.error('Checklist fetch error:', error)
    return NextResponse.json(
      { error: 'Checklist yüklenirken hata oluştu', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = checklistSchema.parse(body)
    let eventIdForProject: string | null = validatedData.eventId ?? null
    if (validatedData.eventId) {
      const eventAccess = await requireEventAccess(request, validatedData.eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }
    if (validatedData.taskId) {
      const task = await prisma.task.findUnique({ where: { id: validatedData.taskId }, select: { eventId: true } })
      if (task) {
        const eventAccess = await requireEventAccess(request, task.eventId)
        if (eventAccess instanceof NextResponse) return eventAccess
        eventIdForProject = task.eventId
      }
    }
    const projectId = await getProjectIdForEvent(eventIdForProject)
    const access = await requireCategoryAccess(request, validatedData.category, projectId)
    if (access instanceof NextResponse) return access

    const cols = await getTableColumns('checklist_items')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')
    const includeAttachments = await tableExists('attachments')

    const normalizedDescription =
      validatedData.description === null || validatedData.description === ''
        ? null
        : validatedData.description

    const selectOptions: any = {
      id: true,
      category: true,
      title: true,
      ...(hasDescription ? { description: true } : {}),
      ...(cols.has('eventId') ? { eventId: true } : {}),
      ...(cols.has('taskId') ? { taskId: true } : {}),
      ...(hasAssignedToColumn ? { assignedTo: true } : {}),
      ...(hasAssignedToColumn
        ? { assignedUser: { select: { id: true, name: true, email: true } } }
        : {}),
      ...(hasDueDate ? { dueDate: true } : {}),
      ...(hasStatus ? { status: true } : {}),
      ...(hasCompletedAt ? { completedAt: true } : {}),
      ...(hasCreatedAt ? { createdAt: true } : {}),
      ...(hasUpdatedAt ? { updatedAt: true } : {}),
      ...(includeAttachments ? { attachments: { orderBy: { createdAt: 'desc' as const } } } : {}),
    }

    const item = await prisma.checklistItem.create({
      data: {
        category: validatedData.category,
        title: validatedData.title,
        ...(hasDescription ? { description: normalizedDescription } : {}),
        ...(cols.has('eventId') ? { eventId: validatedData.eventId || undefined } : {}),
        ...(cols.has('taskId') ? { taskId: validatedData.taskId || undefined } : {}),
        ...(hasAssignedToColumn ? { assignedTo: validatedData.assignedTo || undefined } : {}),
        ...(hasDueDate ? { dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined } : {}),
        ...(hasStatus ? { status: validatedData.status || 'NOT_STARTED' } : {}),
      },
      select: selectOptions,
    })

    return NextResponse.json(
      {
        ...item,
        attachments: (item as any).attachments || [],
        description: (item as any).description ?? null,
        status: (item as any).status ?? 'NOT_STARTED',
        dueDate: (item as any).dueDate ?? null,
        completedAt: (item as any).completedAt ?? null,
        createdAt: (item as any).createdAt ?? null,
        updatedAt: (item as any).updatedAt ?? null,
        assignedTo: (item as any).assignedTo ?? null,
        warning: !hasDescription
          ? 'DB-Schema ist veraltet: Spalte checklist_items.description fehlt, Notizen können nicht gespeichert werden.'
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

    console.error('Checklist creation error:', error)
    return NextResponse.json(
      { error: 'Checklist öğesi oluşturulurken hata oluştu' },
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

    const existing = await prisma.checklistItem.findUnique({
      where: { id },
      select: { category: true, eventId: true, taskId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Checklist-Eintrag nicht gefunden' }, { status: 404 })
    }
    let eventIdForProject: string | null = existing.eventId
    if (existing.eventId) {
      const eventAccess = await requireEventAccess(request, existing.eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }
    if (existing.taskId) {
      const task = await prisma.task.findUnique({ where: { id: existing.taskId }, select: { eventId: true } })
      if (task) {
        const eventAccess = await requireEventAccess(request, task.eventId)
        if (eventAccess instanceof NextResponse) return eventAccess
        eventIdForProject = task.eventId
      }
    }
    const projectId = await getProjectIdForEvent(eventIdForProject)
    const access = await requireCategoryAccess(request, existing.category, projectId)
    if (access instanceof NextResponse) return access

    const cols = await getTableColumns('checklist_items')
    const hasDescription = cols.has('description')
    const hasStatus = cols.has('status')
    const hasDueDate = cols.has('dueDate') || cols.has('duedate')
    const hasCompletedAt = cols.has('completedAt') || cols.has('completedat')
    const hasCreatedAt = cols.has('createdAt') || cols.has('createdat')
    const hasUpdatedAt = cols.has('updatedAt') || cols.has('updatedat')
    const hasAssignedToColumn = cols.has('assignedTo') || cols.has('assignedto')

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
    if (hasDueDate && updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate && updateData.dueDate !== '' 
        ? new Date(updateData.dueDate) 
        : null
    }

    const item = await prisma.checklistItem.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        category: true,
        title: true,
        ...(hasDescription ? { description: true } : {}),
        ...(cols.has('eventId') ? { eventId: true } : {}),
        ...(cols.has('taskId') ? { taskId: true } : {}),
        ...(hasAssignedToColumn ? { assignedTo: true } : {}),
        ...(hasAssignedToColumn
          ? { assignedUser: { select: { id: true, name: true, email: true } } }
          : {}),
        ...(hasDueDate ? { dueDate: true } : {}),
        ...(hasStatus ? { status: true } : {}),
        ...(hasCompletedAt ? { completedAt: true } : {}),
        ...(hasCreatedAt ? { createdAt: true } : {}),
        ...(hasUpdatedAt ? { updatedAt: true } : {}),
      },
    })

    return NextResponse.json({
      ...item,
      description: (item as any).description ?? null,
      status: (item as any).status ?? 'NOT_STARTED',
      dueDate: (item as any).dueDate ?? null,
      completedAt: (item as any).completedAt ?? null,
      createdAt: (item as any).createdAt ?? null,
      updatedAt: (item as any).updatedAt ?? null,
      assignedTo: (item as any).assignedTo ?? null,
      warning: !hasDescription
        ? 'DB-Schema ist veraltet: Spalte checklist_items.description fehlt, Notizen können nicht gespeichert werden.'
        : null,
    })
  } catch (error) {
    console.error('Checklist update error:', error)
    return NextResponse.json(
      { error: 'Checklist öğesi güncellenirken hata oluştu' },
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

    const existing = await prisma.checklistItem.findUnique({
      where: { id },
      select: { category: true, eventId: true, taskId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Checklist-Eintrag nicht gefunden' }, { status: 404 })
    }
    let eventIdForProject: string | null = existing.eventId
    if (existing.eventId) {
      const eventAccess = await requireEventAccess(request, existing.eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }
    if (existing.taskId) {
      const task = await prisma.task.findUnique({ where: { id: existing.taskId }, select: { eventId: true } })
      if (task) {
        const eventAccess = await requireEventAccess(request, task.eventId)
        if (eventAccess instanceof NextResponse) return eventAccess
        eventIdForProject = task.eventId
      }
    }
    const projectId = await getProjectIdForEvent(eventIdForProject)
    const access = await requireCategoryAccess(request, existing.category, projectId)
    if (access instanceof NextResponse) return access

    await prisma.checklistItem.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Checklist öğesi silindi' })
  } catch (error) {
    console.error('Checklist deletion error:', error)
    return NextResponse.json(
      { error: 'Checklist öğesi silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
