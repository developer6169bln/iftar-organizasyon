import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const taskSchema = z.object({
  eventId: z.string(),
  category: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
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

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Tasks fetch error:', error)
    return NextResponse.json(
      { error: 'Görevler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = taskSchema.parse(body)

    const task = await prisma.task.create({
      data: {
        eventId: validatedData.eventId,
        category: validatedData.category,
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status || 'PENDING',
        priority: validatedData.priority || 'MEDIUM',
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Task creation error:', error)
    return NextResponse.json(
      { error: 'Görev oluşturulurken hata oluştu' },
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
    if (updateData.priority !== undefined) dataToUpdate.priority = updateData.priority
    if (updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate && updateData.dueDate !== '' 
        ? new Date(updateData.dueDate) 
        : null
    }

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Task update error:', error)
    return NextResponse.json(
      { error: 'Görev güncellenirken hata oluştu' },
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
