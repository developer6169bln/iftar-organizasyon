import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // Event'i al veya oluştur
    let event = await prisma.event.findFirst({
      where: {
        date: new Date('2026-02-27'),
      },
    })

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

    // Protokol Tasks erstellen
    const protocolTasks = [
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Protokol sıralamasının belirlenmesi',
        description: 'VIP misafirlerin protokol sıralamasını belirleme',
        status: 'PENDING',
        priority: 'HIGH',
      },
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'VIP oturma düzeni',
        description: 'VIP misafirler için oturma planı hazırlama',
        status: 'PENDING',
        priority: 'HIGH',
      },
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Protokol giriş-çıkış planı',
        description: 'VIP misafirlerin giriş ve çıkış planlaması',
        status: 'PENDING',
        priority: 'MEDIUM',
      },
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Refakatçi atamaları',
        description: 'VIP misafirler için refakatçi görevlendirmeleri',
        status: 'PENDING',
        priority: 'MEDIUM',
      },
    ]

    // Protokol Checklist Items erstellen
    const protocolChecklist = [
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Protokol listesi hazır',
        description: 'Tüm VIP misafirlerin protokol listesi hazırlandı',
        status: 'NOT_STARTED',
      },
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Oturma planı onaylandı',
        description: 'VIP oturma düzeni onaylandı',
        status: 'NOT_STARTED',
      },
      {
        eventId: event.id,
        category: 'PROTOCOL',
        title: 'Refakatçiler bilgilendirildi',
        description: 'Tüm refakatçiler görevleri hakkında bilgilendirildi',
        status: 'NOT_STARTED',
      },
    ]

    // Tasks erstellen
    const createdTasks = []
    for (const task of protocolTasks) {
      const created = await prisma.task.create({
        data: task,
      })
      createdTasks.push(created)
    }

    // Checklist Items erstellen
    const createdChecklist = []
    for (const item of protocolChecklist) {
      const created = await prisma.checklistItem.create({
        data: item,
      })
      createdChecklist.push(created)
    }

    return NextResponse.json({
      message: 'Protokol verileri başarıyla oluşturuldu',
      tasks: createdTasks.length,
      checklist: createdChecklist.length,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Veri oluşturulurken hata oluştu', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
