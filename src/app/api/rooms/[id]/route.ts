import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { z } from 'zod'

/** Raum aktualisieren oder löschen. Nur Admin. */
async function requireAdmin(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Nur der Admin kann Räume verwalten' }, { status: 403 })
  return userId
}

const updateSchema = z.object({ name: z.string().min(1).optional(), description: z.string().optional() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin(request)
  if (typeof userId !== 'string') return userId
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  const room = await prisma.room.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
  const updated = await prisma.room.update({
    where: { id },
    data: {
      ...(parsed.data.name != null && { name: parsed.data.name.trim() }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description?.trim() || null }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin(request)
  if (typeof userId !== 'string') return userId
  const { id } = await params
  const room = await prisma.room.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
  await prisma.room.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
