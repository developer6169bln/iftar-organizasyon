import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Event oluştur veya mevcut event'i getir
export async function GET() {
  try {
    // Şimdilik tek bir event (27.02.2026)
    let event = await prisma.event.findFirst({
      where: {
        date: new Date('2026-02-27'),
      },
    })

    // Event yoksa oluştur
    if (!event) {
      event = await prisma.event.create({
        data: {
          title: 'Iftar Yemeği - Titanic Hotel',
          date: new Date('2026-02-27'),
          location: 'Titanic Hotel',
          description: '27 Şubat 2026 tarihinde Titanic Otel\'de verilecek iftar yemeği organizasyonu',
          status: 'PLANNING',
        },
      })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Event fetch error:', error)
    return NextResponse.json(
      { error: 'Event yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const event = await prisma.event.create({
      data: {
        title: body.title,
        date: new Date(body.date),
        location: body.location,
        description: body.description,
        status: body.status || 'PLANNING',
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Event creation error:', error)
    return NextResponse.json(
      { error: 'Event oluşturulurken hata oluştu' },
      { status: 500 }
    )
  }
}
