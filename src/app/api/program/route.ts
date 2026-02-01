import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

const programItemSchema = z.object({
  eventId: z.string(),
  type: z.enum(['SPEECH', 'MUSIC', 'EZAN', 'QURAN', 'HITABET', 'IFTAR_START', 'SUNUCU']),
  title: z.string().min(1),
  speakerName: z.string().optional(),
  topic: z.string().optional(),
  duration: z.number().min(1),
  startTime: z.string(), // ISO date string
  order: z.number().int().min(0),
  musicType: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'program_flow')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId gereklidir' },
        { status: 400 }
      )
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const items = await prisma.programItem.findMany({
      where: { eventId },
      orderBy: {
        order: 'asc',
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Program items fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Program öğeleri yüklenirken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'program_flow')
  if (access instanceof NextResponse) return access
  try {
    const body = await request.json()
    const validatedData = programItemSchema.parse(body)
    const eventAccess = await requireEventAccess(request, validatedData.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    // Validierung für startTime
    const startTime = validatedData.startTime ? new Date(validatedData.startTime) : null
    if (!startTime || isNaN(startTime.getTime())) {
      return NextResponse.json(
        { error: 'Ungültige Startzeit' },
        { status: 400 }
      )
    }

    const item = await prisma.programItem.create({
      data: {
        eventId: validatedData.eventId,
        type: validatedData.type,
        title: validatedData.title,
        speakerName: validatedData.speakerName || null,
        topic: validatedData.topic || null,
        duration: validatedData.duration,
        startTime: startTime,
        order: validatedData.order,
        musicType: validatedData.musicType || null,
        notes: validatedData.notes || null,
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

    console.error('Program item creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Program öğesi oluşturulurken hata oluştu', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requirePageAccess(request, 'program_flow')
  if (access instanceof NextResponse) return access
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }
    const existing = await prisma.programItem.findUnique({ where: { id }, select: { eventId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Programmpunkt nicht gefunden' }, { status: 404 })
    }
    const eventAccess = await requireEventAccess(request, existing.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const dataToUpdate: any = {}
    
    if (updateData.type !== undefined) dataToUpdate.type = updateData.type
    if (updateData.title !== undefined) dataToUpdate.title = updateData.title
    if (updateData.speakerName !== undefined) dataToUpdate.speakerName = updateData.speakerName || null
    if (updateData.topic !== undefined) dataToUpdate.topic = updateData.topic || null
    if (updateData.duration !== undefined) dataToUpdate.duration = updateData.duration
    if (updateData.startTime !== undefined) {
      if (updateData.startTime && updateData.startTime !== '') {
        const startTime = new Date(updateData.startTime)
        if (!isNaN(startTime.getTime())) {
          dataToUpdate.startTime = startTime
        }
      } else {
        dataToUpdate.startTime = null
      }
    }
    if (updateData.order !== undefined) dataToUpdate.order = updateData.order
    if (updateData.musicType !== undefined) dataToUpdate.musicType = updateData.musicType || null
    if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes || null

    const item = await prisma.programItem.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Program item update error:', error)
    return NextResponse.json(
      { error: 'Program öğesi güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requirePageAccess(request, 'program_flow')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }
    const existing = await prisma.programItem.findUnique({ where: { id }, select: { eventId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Programmpunkt nicht gefunden' }, { status: 404 })
    }
    const eventAccess = await requireEventAccess(request, existing.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    await prisma.programItem.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Program öğesi silindi' })
  } catch (error) {
    console.error('Program item deletion error:', error)
    return NextResponse.json(
      { error: 'Program öğesi silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
