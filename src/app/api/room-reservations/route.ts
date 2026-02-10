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

  try {
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('responsibleUserId') && !msg.includes('eventLeaderId') && !msg.includes('does not exist') && !msg.includes('room_reservations')) {
      throw e
    }
    try {
      const list = await listReservationsFallback(where)
      return NextResponse.json(list)
    } catch {
      return NextResponse.json([])
    }
  }
}

/** Fallback wenn DB nur Basis-Migration hat (ohne responsibleUserId/eventLeaderId). */
async function listReservationsFallback(where: { roomId?: string; startAt?: { gte?: Date; lte?: Date } }) {
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 0
  if (where.roomId) {
    i++; conditions.push(`r."roomId" = $${i}`); params.push(where.roomId)
  }
  if (where.startAt?.gte) {
    i++; conditions.push(`r."startAt" >= $${i}`); params.push(where.startAt.gte)
  }
  if (where.startAt?.lte) {
    i++; conditions.push(`r."startAt" <= $${i}`); params.push(where.startAt.lte)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      roomId: string
      projectId: string | null
      eventId: string | null
      reservedByUserId: string
      title: string
      startAt: Date
      endAt: Date | null
      notes: string | null
      room_id: string
      room_name: string
      project_id: string | null
      project_name: string | null
      event_id: string | null
      event_title: string | null
      event_date: string | null
      reservedBy_id: string
      reservedBy_name: string | null
      reservedBy_email: string
    }>
  >(
    `SELECT r.id, r."roomId", r."projectId", r."eventId", r."reservedByUserId", r.title, r."startAt", r."endAt", r.notes,
       ro.id AS room_id, ro.name AS room_name,
       p.id AS project_id, p.name AS project_name,
       e.id AS event_id, e.title AS event_title, e.date AS event_date,
       u.id AS reservedBy_id, u.name AS reservedBy_name, u.email AS reservedBy_email
     FROM room_reservations r
     JOIN rooms ro ON ro.id = r."roomId"
     LEFT JOIN projects p ON p.id = r."projectId"
     LEFT JOIN events e ON e.id = r."eventId"
     JOIN users u ON u.id = r."reservedByUserId"
     ${whereClause}
     ORDER BY r."startAt" ASC`,
    ...params
  )
  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    projectId: row.projectId,
    eventId: row.eventId,
    title: row.title,
    startAt: row.startAt,
    endAt: row.endAt,
    notes: row.notes,
    room: { id: row.room_id, name: row.room_name },
    project: row.project_id ? { id: row.project_id, name: row.project_name } : null,
    event: row.event_id ? { id: row.event_id, title: row.event_title, date: row.event_date } : null,
    reservedBy: { id: row.reservedBy_id, name: row.reservedBy_name, email: row.reservedBy_email },
    responsibleUser: null,
    eventLeader: null,
  }))
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
