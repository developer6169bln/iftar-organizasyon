import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { requirePageAccess } from '@/lib/permissions'
import { z } from 'zod'

/** Räume auflisten (für alle mit Zugriff auf Raum-Reservierungen). */
export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access
  const rooms = await prisma.room.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { reservations: true } } },
  })
  return NextResponse.json(rooms)
}

const createRoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

/** Raum anlegen. Nur Admin. */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access
  const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { role: true } })
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur der Admin kann Räume anlegen' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = createRoomSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'name erforderlich' }, { status: 400 })
  }
  const room = await prisma.room.create({
    data: { name: parsed.data.name.trim(), description: parsed.data.description?.trim() || null },
  })
  return NextResponse.json(room)
}
