import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const guestSchema = z.object({
  eventId: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  organization: z.string().optional(),
  tableNumber: z.number().optional(),
  isVip: z.boolean().optional(),
  needsSpecialReception: z.boolean().optional(),
  receptionBy: z.string().optional(),
  arrivalDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const status = searchParams.get('status')

    const where: any = {}
    if (eventId) {
      where.eventId = eventId
    }
    if (status) {
      where.status = status
    }
    const needsReception = searchParams.get('needsReception')
    if (needsReception === 'true') {
      where.needsSpecialReception = true
    }

    const guests = await prisma.guest.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(guests)
  } catch (error) {
    console.error('Guests fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Misafirler yüklenirken hata oluştu',
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
    const validatedData = guestSchema.parse(body)

    const guest = await prisma.guest.create({
      data: {
        eventId: validatedData.eventId,
        name: validatedData.name,
        email: validatedData.email && validatedData.email !== '' ? validatedData.email : null,
        phone: validatedData.phone || null,
        title: validatedData.title || null,
        organization: validatedData.organization || null,
        tableNumber: validatedData.tableNumber || null,
        isVip: validatedData.isVip === true,
        needsSpecialReception: validatedData.needsSpecialReception === true,
        receptionBy: validatedData.receptionBy && validatedData.receptionBy !== '' ? validatedData.receptionBy : null,
        arrivalDate: validatedData.arrivalDate && validatedData.arrivalDate !== '' 
          ? (isNaN(Date.parse(validatedData.arrivalDate)) ? null : new Date(validatedData.arrivalDate))
          : null,
        notes: validatedData.notes || null,
        status: 'INVITED',
      },
    })

    return NextResponse.json(guest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Guest creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Misafir oluşturulurken hata oluştu', details: errorMessage },
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

    // Daten für Update vorbereiten
    const dataToUpdate: any = {}
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name
    if (updateData.email !== undefined) {
      dataToUpdate.email = updateData.email && updateData.email !== '' ? updateData.email : null
    }
    if (updateData.phone !== undefined) {
      dataToUpdate.phone = updateData.phone && updateData.phone !== '' ? updateData.phone : null
    }
    if (updateData.title !== undefined) {
      dataToUpdate.title = updateData.title && updateData.title !== '' ? updateData.title : null
    }
    if (updateData.organization !== undefined) {
      dataToUpdate.organization = updateData.organization && updateData.organization !== '' ? updateData.organization : null
    }
    if (updateData.tableNumber !== undefined) {
      dataToUpdate.tableNumber = updateData.tableNumber && updateData.tableNumber !== '' 
        ? (typeof updateData.tableNumber === 'string' ? parseInt(updateData.tableNumber) : updateData.tableNumber)
        : null
    }
    if (updateData.isVip !== undefined) {
      dataToUpdate.isVip = updateData.isVip === true || updateData.isVip === 'true' || updateData.isVip === 1
    }
    if (updateData.status !== undefined) dataToUpdate.status = updateData.status
    if (updateData.notes !== undefined) {
      dataToUpdate.notes = updateData.notes && updateData.notes !== '' ? updateData.notes : null
    }
    if (updateData.arrivalTime !== undefined) {
      dataToUpdate.arrivalTime = updateData.arrivalTime ? new Date(updateData.arrivalTime) : null
    }
    if (updateData.arrivalDate !== undefined) {
      dataToUpdate.arrivalDate = updateData.arrivalDate && updateData.arrivalDate !== '' 
        ? (isNaN(Date.parse(updateData.arrivalDate)) ? null : new Date(updateData.arrivalDate))
        : null
    }
    if (updateData.needsSpecialReception !== undefined) {
      dataToUpdate.needsSpecialReception = updateData.needsSpecialReception === true || updateData.needsSpecialReception === 'true' || updateData.needsSpecialReception === 1
    }
    if (updateData.receptionBy !== undefined) {
      dataToUpdate.receptionBy = updateData.receptionBy && updateData.receptionBy !== '' ? updateData.receptionBy : null
    }

    const guest = await prisma.guest.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(guest)
  } catch (error) {
    console.error('Guest update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Misafir güncellenirken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}
