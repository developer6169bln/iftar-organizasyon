import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getProjectsForUser } from '@/lib/permissions'

/** Prüft, ob die Tabelle events eine Spalte projectId hat (Migration möglicherweise noch nicht ausgeführt). */
async function eventsHasProjectId(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT 1 as count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'projectId'
      LIMIT 1
    `
    return (rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

/** Events des Nutzers (aus seinen Projekten). Optional: projectId filtert auf ein Projekt. Vorhandene/Legacy-Events (projectId null) = nur APP-Admin. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    const projectIdParam = request.nextUrl.searchParams.get('projectId') || undefined

    const hasProjectIdColumn = await eventsHasProjectId()
    const projects = userId ? await getProjectsForUser(userId) : []
    const projectIds = projects.map((p) => p.id)
    const isAdmin = userId
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === 'ADMIN'
      : false

    // Ohne projectId-Spalte: Legacy-DB – bei Projekt-Filter Fehlerhinweis, sonst erstes Event
    if (!hasProjectIdColumn) {
      if (projectIdParam) {
        return NextResponse.json(
          {
            error: 'Event konnte nicht geladen werden',
            details: 'Spalte events.projectId fehlt in der Datenbank. Bitte Migration ausführen (z. B. prisma migrate deploy) oder das SQL-Skript für events.projectId anwenden.',
          },
          { status: 500 }
        )
      }
      if (!userId) {
        return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
      }
      const event = await prisma.event.findFirst({
        orderBy: { date: 'asc' },
      })
      return NextResponse.json(event ?? null)
    }

    const projectId = projectIdParam
    let where: Prisma.EventWhereInput | undefined
    if (projectId) {
      if (projectIds.length && !projectIds.includes(projectId)) {
        return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
      }
      where = { projectId }
    } else if (projectIds.length) {
      if (isAdmin) {
        where = { OR: [{ projectId: { in: projectIds } }, { projectId: null }] }
      } else {
        where = { projectId: { in: projectIds } }
      }
    } else if (userId) {
      where = { projectId: { in: [] } }
    }

    let event = await prisma.event.findFirst({
      where,
      orderBy: { date: 'asc' },
    })

    if (!event && userId && projects.length) {
      const firstProjectId = projects[0].id
      event = await prisma.event.findFirst({
        where: { projectId: firstProjectId },
        orderBy: { date: 'asc' },
      })
      if (!event) {
        event = await prisma.event.create({
          data: {
            projectId: firstProjectId,
            title: 'Mein Event',
            date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            location: '',
            description: null,
            status: 'PLANNING',
          },
        })
      }
    }

    if (!event && !userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    if (!event) {
      return NextResponse.json(null)
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('Event fetch error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Event konnte nicht geladen werden', details: message },
      { status: 500 }
    )
  }
}

/** Neues Event anlegen (nur innerhalb eines Projekts, auf das der User Zugriff hat). */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const body = await request.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId ist erforderlich' }, { status: 400 })
    }

    const projects = await getProjectsForUser(userId)
    const canAccess = projects.some((p) => p.id === projectId && p.isOwner)
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    const isAdmin = me?.role === 'ADMIN'
    if (!canAccess && !isAdmin) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt oder nur Projektmitarbeiter können keine Events anlegen' }, { status: 403 })
    }

    const event = await prisma.event.create({
      data: {
        projectId,
        title: body.title ?? 'Neues Event',
        date: body.date ? new Date(body.date) : new Date(),
        location: body.location ?? '',
        description: body.description ?? null,
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
