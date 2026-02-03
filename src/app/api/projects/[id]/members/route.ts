import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { ALL_PAGE_IDS } from '@/lib/permissions'

/** Projektmitarbeiter auflisten (nur Owner oder Admin). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id: projectId } = await params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf Mitglieder einsehen' }, { status: 403 })
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        categoryPermissions: { select: { categoryId: true, allowed: true } },
        pagePermissions: { select: { pageId: true, allowed: true } },
      },
    })
    return NextResponse.json(members)
  } catch (error) {
    console.error('GET /api/projects/[id]/members error:', error)
    return NextResponse.json({ error: 'Mitglieder konnten nicht geladen werden' }, { status: 500 })
  }
}

/** Projektmitarbeiter hinzufügen (nur Owner oder Admin). Limit: Edition maxProjectStaffPerProject. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const resolvedParams = await params
    const projectId = resolvedParams?.id
    if (!projectId) {
      return NextResponse.json({ error: 'Projekt-ID fehlt' }, { status: 400 })
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    const isOwner = project.ownerId === userId
    const isAdmin = me?.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf Mitglieder hinzufügen' }, { status: 403 })
    }

    const body = await request.json()
    const memberUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
    if (!memberUserId) {
      return NextResponse.json({ error: 'userId ist erforderlich' }, { status: 400 })
    }

    // 0 oder nicht gesetzt = kein Limit (Hauptnutzer dürfen dann Projektmitarbeiter anlegen)
    let maxStaff = isAdmin ? 999 : 0
    if (!isAdmin) {
      try {
        const owner = await prisma.user.findUnique({
          where: { id: project.ownerId },
          select: { edition: { select: { maxProjectStaffPerProject: true } } },
        })
        maxStaff = owner?.edition?.maxProjectStaffPerProject ?? 0
      } catch {
        maxStaff = 0
      }
    }
    let currentCount = 0
    try {
      currentCount = await prisma.projectMember.count({ where: { projectId } })
    } catch {
      // project_members-Tabelle fehlt evtl.
    }
    if (maxStaff > 0 && currentCount >= maxStaff) {
      return NextResponse.json(
        { error: `Maximale Anzahl Projektmitarbeiter (${maxStaff}) erreicht. Bitte Edition erweitern.` },
        { status: 403 }
      )
    }

    const targetUser = await prisma.user.findUnique({ where: { id: memberUserId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: memberUserId } },
      create: { projectId, userId: memberUserId, role: (body.role as string) || 'MEMBER' },
      update: { role: (body.role as string) || 'MEMBER' },
      include: { user: { select: { id: true, email: true, name: true } } },
    })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/members error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Mitglied konnte nicht hinzugefügt werden', details: message },
      { status: 500 }
    )
  }
}

/** Berechtigungen eines Projektmitarbeiters aktualisieren (nur Owner oder Admin). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id: projectId } = await params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    const isOwner = project.ownerId === userId
    const isAdmin = me?.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf Berechtigungen ändern' }, { status: 403 })
    }

    const body = await request.json()
    const memberUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
    if (!memberUserId) {
      return NextResponse.json({ error: 'userId ist erforderlich' }, { status: 400 })
    }

    const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.filter((c: unknown) => typeof c === 'string') : undefined
    const pageIds = Array.isArray(body.pageIds) ? body.pageIds.filter((p: unknown) => typeof p === 'string') : undefined

    await prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: memberUserId } },
      })
      if (!member) {
        throw new Error('Mitglied nicht gefunden')
      }
      if (categoryIds !== undefined) {
        await tx.projectMemberCategoryPermission.deleteMany({ where: { projectId, userId: memberUserId } })
        for (const categoryId of categoryIds) {
          await tx.projectMemberCategoryPermission.create({
            data: { projectId, userId: memberUserId, categoryId, allowed: true },
          })
        }
      }
      if (pageIds !== undefined) {
        await tx.projectMemberPagePermission.deleteMany({ where: { projectId, userId: memberUserId } })
        for (const pageId of pageIds) {
          if (ALL_PAGE_IDS.includes(pageId as any)) {
            await tx.projectMemberPagePermission.create({
              data: { projectId, userId: memberUserId, pageId, allowed: true },
            })
          }
        }
      }
      if (typeof body.role === 'string') {
        await tx.projectMember.update({
          where: { projectId_userId: { projectId, userId: memberUserId } },
          data: { role: body.role },
        })
      }
    })

    const updated = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberUserId } },
      include: {
        user: { select: { id: true, email: true, name: true } },
        categoryPermissions: { select: { categoryId: true, allowed: true } },
        pagePermissions: { select: { pageId: true, allowed: true } },
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/projects/[id]/members error:', error)
    return NextResponse.json({ error: 'Berechtigungen konnten nicht aktualisiert werden' }, { status: 500 })
  }
}

/** Projektmitarbeiter entfernen (nur Owner oder Admin). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const { id: projectId } = await params
    const memberUserId = request.nextUrl.searchParams.get('userId') || ''
    if (!memberUserId) {
      return NextResponse.json({ error: 'userId (Query) ist erforderlich' }, { status: 400 })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    const isOwner = project.ownerId === userId
    const isAdmin = me?.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Nur der Projektinhaber oder ein Admin darf Mitglieder entfernen' }, { status: 403 })
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId: memberUserId },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/members error:', error)
    return NextResponse.json({ error: 'Mitglied konnte nicht entfernt werden' }, { status: 500 })
  }
}
