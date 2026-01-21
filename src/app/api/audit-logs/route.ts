import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest, createAuditLog } from '@/lib/auditLog'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const eventId = searchParams.get('eventId')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}
    if (userId) where.userId = userId
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (eventId) where.eventId = eventId
    if (action) where.action = action
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Get audit logs
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    // Parse JSON fields
    const logsWithParsed = logs.map(log => ({
      ...log,
      oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    return NextResponse.json({
      logs: logsWithParsed,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Audit logs fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: 'Fehler beim Laden der Audit-Logs', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const olderThan = searchParams.get('olderThan') // Anzahl Tage

    if (!olderThan) {
      return NextResponse.json(
        { error: 'olderThan Parameter erforderlich (Anzahl Tage)' },
        { status: 400 }
      )
    }

    const days = parseInt(olderThan)
    if (isNaN(days) || days < 1) {
      return NextResponse.json(
        { error: 'olderThan muss eine positive Zahl sein' },
        { status: 400 }
      )
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} Audit-Logs gelöscht (älter als ${days} Tage)`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Audit logs delete error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Audit-Logs', details: errorMessage },
      { status: 500 }
    )
  }
}
