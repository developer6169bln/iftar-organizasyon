import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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

    // Prüfe ob attachments Tabelle existiert
    let includeAttachments = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'attachments'
        ) as exists
      `
      includeAttachments = result[0]?.exists === true
    } catch (e) {
      // Tabelle existiert nicht, ignoriere
      includeAttachments = false
    }

    // Prüfe ob assignedTo Spalte existiert (für assignedUser Relation)
    let hasAssignedToColumn = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name IN ('assignedTo', 'assignedto')
        ) as exists
      `
      hasAssignedToColumn = result[0]?.exists === true
    } catch (e) {
      hasAssignedToColumn = false
    }

    // Build select/include dynamically so Prisma won't reference missing columns
    const baseSelect: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    }

    if (hasAssignedToColumn) {
      baseSelect.assignedTo = true
      baseSelect.assignedUser = {
        select: { id: true, name: true, email: true },
      }
    }

    // Prüfe ob task_assignments Tabelle existiert
    let includeAssignments = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'task_assignments'
        ) as exists
      `
      includeAssignments = result[0]?.exists === true
    } catch (e) {
      includeAssignments = false
    }

    if (includeAssignments) {
      baseSelect.assignments = {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }
    }

    if (includeAttachments) {
      baseSelect.attachments = {
        orderBy: {
          createdAt: 'desc' as const,
        },
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      select: baseSelect,
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Füge leere Arrays hinzu, falls nicht vorhanden
    const tasksWithDefaults = tasks.map((task: any) => ({
      ...task,
      attachments: task.attachments || [],
      assignments: task.assignments || [],
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

    // Prüfe ob assignedTo Spalte existiert (Railway kann ohne Migration laufen)
    let hasAssignedToColumn = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name IN ('assignedTo', 'assignedto')
        ) as exists
      `
      hasAssignedToColumn = result[0]?.exists === true
    } catch (e) {
      hasAssignedToColumn = false
    }

    // Prüfe ob task_assignments Tabelle existiert (für include)
    let includeAssignments = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'task_assignments'
        ) as exists
      `
      includeAssignments = result[0]?.exists === true
    } catch (e) {
      includeAssignments = false
    }

    const normalizedDescription =
      validatedData.description === null || validatedData.description === ''
        ? null
        : validatedData.description

    const includeOptions: any = {}
    if (includeAssignments) {
      includeOptions.assignments = {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }
    }
    if (hasAssignedToColumn) {
      includeOptions.assignedUser = {
        select: { id: true, name: true, email: true },
      }
    }

    const selectOptions: any = {
      id: true,
      eventId: true,
      category: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      ...(includeAssignments ? { assignments: includeOptions.assignments } : {}),
      ...(hasAssignedToColumn ? { assignedTo: true, assignedUser: includeOptions.assignedUser } : {}),
    }

    const task = await prisma.task.create({
      data: {
        eventId: validatedData.eventId,
        category: validatedData.category,
        title: validatedData.title,
        description: normalizedDescription,
        status: validatedData.status || 'PENDING',
        priority: validatedData.priority || 'MEDIUM',
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
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
        assignedTo: (task as any).assignedTo ?? null,
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

    // Prüfe ob assignedTo Spalte existiert (Railway kann ohne Migration laufen)
    let hasAssignedToColumn = false
    try {
      const result = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name IN ('assignedTo', 'assignedto')
        ) as exists
      `
      hasAssignedToColumn = result[0]?.exists === true
    } catch (e) {
      hasAssignedToColumn = false
    }

    const dataToUpdate: any = {}
    
    if (updateData.title !== undefined) dataToUpdate.title = updateData.title
    if (updateData.description !== undefined) {
      dataToUpdate.description = updateData.description === '' ? null : (updateData.description ?? null)
    }
    if (updateData.status !== undefined) {
      dataToUpdate.status = updateData.status
      if (updateData.status === 'COMPLETED') {
        dataToUpdate.completedAt = new Date()
      }
    }
    if (updateData.priority !== undefined) dataToUpdate.priority = updateData.priority
    if (updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate && updateData.dueDate !== '' 
        ? new Date(updateData.dueDate) 
        : null
    }
    if (hasAssignedToColumn && updateData.assignedTo !== undefined) {
      dataToUpdate.assignedTo =
        updateData.assignedTo && updateData.assignedTo !== '' ? updateData.assignedTo : null
    }

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        eventId: true,
        category: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
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
      assignedTo: (task as any).assignedTo ?? null,
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

    await prisma.task.delete({
      where: { id },
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
