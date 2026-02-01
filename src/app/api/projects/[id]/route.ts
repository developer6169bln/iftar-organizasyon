import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

/** Einzelnes Projekt (nur wenn Owner oder Mitglied). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id } = await params
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { events: true, members: true } },
      },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden oder kein Zugriff' }, { status: 404 })
    }
    return NextResponse.json(project)
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Projekt konnte nicht geladen werden' }, { status: 500 })
  }
}

/** Projekt bearbeiten (nur Owner oder Admin). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    const isOwner = project.ownerId === userId
    const isAdmin = user?.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf das Projekt bearbeiten' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const data: { name?: string } = {}
    if (name) data.name = name

    const updated = await prisma.project.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Projekt konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

/** Projekt löschen (nur Owner oder Admin). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    const isOwner = project.ownerId === userId
    const isAdmin = user?.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf das Projekt löschen' }, { status: 403 })
    }

    await prisma.project.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Projekt konnte nicht gelöscht werden' }, { status: 500 })
  }
}
