import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { requirePageAccess, getProjectsForUser } from '@/lib/permissions'
import { z } from 'zod'

/** Reservierungen auflisten. Optional: roomId, from, to (ISO-Datum). */
export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access
  const roomId = request.nextUrl.searchParams.get('roomId') ?? undefined
  const from = request.nextUrl.searchParams.get('from') ?? undefined
  const to = request.nextUrl.searchParams.get('to') ?? undefined
  const where: { roomId?: string; startAt?: { gte?: Date; lte?: Date } } = {}
  if (roomId) where.roomId = roomId
  if (from || to) {
    where.startAt = {}
    if (from) where.startAt.gte = new Date(from)
    if (to) where.startAt.lte = new Date(to)
  }
  const list = await prisma.roomReservation.findMany({
    where,
    orderBy: { startAt: 'asc' },
    include: {
      room: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      event: { select: { id: true, title: true, date: true } },
      reservedBy: { select: { id: true, name: true, email: true } },
      responsibleUser: { select: { id: true, name: true, email: true } },
      eventLeader: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(list)
}

const createSchema = z.object({
  roomId: z.string(),
  projectId: z.string().optional(),
  eventId: z.string().optional(),
  responsibleUserId: z.string().optional(),
  eventLeaderId: z.string().optional(),
  title: z.string().min(1),
  startAt: z.string(),
  endAt: z.string().optional(),
  notes: z.string().optional(),
})

/** Reservierung anlegen (manuell oder aus Projekt). Admin oder Hauptbenutzer. */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access
  const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { role: true } })
  const projects = await getProjectsForUser(access.userId)
  const isAdmin = user?.role === 'ADMIN'
  const isHauptbenutzer = projects.some((p) => p.isOwner) || (await prisma.user.findUnique({ where: { id: access.userId }, select: { editionId: true } }))?.editionId != null
  if (!isAdmin && !isHauptbenutzer) {
    return NextResponse.json({ error: 'Nur Admin oder Hauptbenutzer können Reservierungen anlegen' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'roomId, title und startAt erforderlich' }, { status: 400 })
  }
  const { roomId, projectId, eventId, responsibleUserId, eventLeaderId, title, startAt, endAt, notes } = parsed.data
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
  if (projectId && !isAdmin) {
    if (!projects.some((p) => p.id === projectId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
    }
  }
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { projectId: true } })
    if (event?.projectId && !isAdmin && !projects.some((p) => p.id === event.projectId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Event' }, { status: 403 })
    }
  }
  const start = new Date(startAt)
  const end = endAt ? new Date(endAt) : null
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Startdatum' }, { status: 400 })
  }

  const baseData = {
    roomId,
    projectId: projectId || null,
    eventId: eventId || null,
    reservedByUserId: access.userId,
    title: title.trim(),
    startAt: start,
    endAt: end,
    notes: notes?.trim() || null,
  }
  const includeRelations = {
    room: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    event: { select: { id: true, title: true, date: true } },
    reservedBy: { select: { id: true, name: true, email: true } },
    responsibleUser: { select: { id: true, name: true, email: true } },
    eventLeader: { select: { id: true, name: true, email: true } },
  }

  try {
    const reservation = await prisma.roomReservation.create({
      data: {
        ...baseData,
        responsibleUserId: responsibleUserId || null,
        eventLeaderId: eventLeaderId || null,
      },
      include: includeRelations,
    })
    return NextResponse.json(reservation)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const hint = (msg.includes('responsibleUserId') || msg.includes('eventLeaderId') || msg.includes('does not exist'))
      ? ' Bitte Datenbank-Migration ausführen (z. B. npx prisma migrate deploy).'
      : ''
    return NextResponse.json(
      { error: `Reservierung konnte nicht gespeichert werden: ${msg}${hint}` },
      { status: 500 }
    )
  }
}
