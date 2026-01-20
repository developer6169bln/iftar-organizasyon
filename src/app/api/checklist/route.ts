import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const checklistSchema = z.object({
  category: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
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

    const where: any = {}
    if (category) {
      where.category = category
    }
    if (eventId) {
      where.eventId = eventId
    }

    const items = await prisma.checklistItem.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Checklist fetch error:', error)
    return NextResponse.json(
      { error: 'Checklist yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = checklistSchema.parse(body)

    const item = await prisma.checklistItem.create({
      data: {
        category: validatedData.category,
        title: validatedData.title,
        description: validatedData.description,
        eventId: validatedData.eventId || undefined,
        taskId: validatedData.taskId || undefined,
        assignedTo: validatedData.assignedTo || undefined,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        status: validatedData.status || 'NOT_STARTED',
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(item, { status: 201 })
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

    const dataToUpdate: any = {}
    
    if (updateData.title !== undefined) dataToUpdate.title = updateData.title
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description || null
    if (updateData.status !== undefined) {
      dataToUpdate.status = updateData.status
      if (updateData.status === 'COMPLETED') {
        dataToUpdate.completedAt = new Date()
      }
    }
    if (updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate && updateData.dueDate !== '' 
        ? new Date(updateData.dueDate) 
        : null
    }

    const item = await prisma.checklistItem.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(item)
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
