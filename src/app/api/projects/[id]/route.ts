import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

/** Einzelnes Projekt (wenn Owner, Mitglied oder Admin). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const resolvedParams = await params
    const id = resolvedParams?.id
    if (!id) {
      return NextResponse.json({ error: 'Projekt-ID fehlt' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    const isAdmin = user?.role === 'ADMIN'

    // Projekt zuerst ohne Relationen laden (robust bei fehlenden Tabellen)
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true, createdAt: true, updatedAt: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const isOwner = project.ownerId === userId
    let isMember = false
    try {
      const count = await prisma.projectMember.count({ where: { projectId: id, userId } })
      isMember = count > 0
    } catch {
      // project_members-Tabelle fehlt evtl.
    }
    if (!isAdmin && !isOwner && !isMember) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
    }

    // Owner und _count optional nachladen (falls Relationen/Tabellen fehlen)
    let owner: { id: string; email: string; name: string } | null = null
    let _count = { events: 0, members: 0 }
    try {
      const [ownerRow, eventsCount, membersCount] = await Promise.all([
        prisma.user.findUnique({
          where: { id: project.ownerId },
          select: { id: true, email: true, name: true },
        }),
        prisma.event.count({ where: { projectId: id } }),
        prisma.projectMember.count({ where: { projectId: id } }).catch(() => 0),
      ])
      owner = ownerRow
      _count = { events: eventsCount, members: membersCount }
    } catch {
      // Fallback: Projekt trotzdem zurückgeben
    }

    return NextResponse.json({
      ...project,
      owner: owner ?? undefined,
      _count,
      isOwner: isOwner || isAdmin,
      isMember,
    })
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    const message = error instanceof Error ? error.message : 'Projekt konnte nicht geladen werden'
    return NextResponse.json(
      { error: 'Projekt konnte nicht geladen werden', details: message },
      { status: 500 }
    )
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
