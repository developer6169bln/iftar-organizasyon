import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hashPassword } from '@/lib/auth'
import { getUserIdFromRequest } from '@/lib/auditLog'

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional(),
  editionId: z.string().nullable().optional(),
})

const patchUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'COORDINATOR']).optional(),
  editionId: z.string().nullable().optional(),
  editionExpiresAt: z.string().nullable().optional(),
  categoryPermissions: z.array(z.object({ categoryId: z.string(), allowed: z.boolean() })).optional(),
  pagePermissions: z.array(z.object({ pageId: z.string(), allowed: z.boolean() })).optional(),
})

/**
 * GET: App-Betreiber (ADMIN) sieht alle Benutzer.
 * Hauptnutzer sehen nur Benutzer, die in ihren eigenen Projekten als Mitglieder eingetragen sind –
 * keine anderen Hauptnutzer und keine Benutzer anderer Hauptnutzer.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Aktuellen User per Raw-SQL (ohne projects-Relation), damit GET auch funktioniert wenn projects-Tabelle fehlt
    let role: string = ''
    let editionId: string | null = null
    try {
      const rows = await prisma.$queryRaw<{ role: string; editionId: string | null }[]>`
        SELECT "role", "editionId" FROM "users" WHERE "id" = ${userId} LIMIT 1
      `
      const row = rows[0]
      if (row) {
        role = row.role
        editionId = row.editionId
      }
    } catch (e) {
      console.error('GET /api/users current user lookup:', e)
      return NextResponse.json(
        { error: 'Benutzer konnten nicht geladen werden', details: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      )
    }

    const isAdmin = role === 'ADMIN'
    const hasEdition = !!editionId
    let isProjectOwner = false
    try {
      const countRows = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) as c FROM "projects" WHERE "ownerId" = ${userId}`
      isProjectOwner = Number(countRows[0]?.c ?? 0) > 0
    } catch {
      // projects-Tabelle fehlt evtl. → nicht Projektinhaber
    }

    if (!isAdmin && !isProjectOwner && !hasEdition) {
      return NextResponse.json({ error: 'Nur für Admin oder Projektinhaber' }, { status: 403 })
    }

    let users: unknown[]
    if (isAdmin) {
      try {
        users = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            editionId: true,
            editionExpiresAt: true,
            createdAt: true,
            edition: { select: { id: true, code: true, name: true } },
            categoryPermissions: { select: { categoryId: true, allowed: true } },
            pagePermissions: { select: { pageId: true, allowed: true } },
            _count: { select: { ownedProjects: true } },
          },
          orderBy: { name: 'asc' },
        })
      } catch {
        users = await prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, editionId: true, editionExpiresAt: true, createdAt: true },
          orderBy: { name: 'asc' },
        })
        const withCount = await Promise.all(
          (users as any[]).map(async (u) => {
            let owned = 0
            try {
              const rows = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(*) as count FROM "projects" WHERE "ownerId" = ${u.id}
              `
              owned = Number(rows[0]?.count ?? 0)
            } catch {
              // ignore
            }
            return { ...u, _count: { ownedProjects: owned } }
          })
        )
        users = withCount
      }
    } else {
      try {
        const memberUserIds = await prisma.projectMember.findMany({
          where: { project: { ownerId: userId } },
          select: { userId: true },
          distinct: ['userId'],
        })
        const ids = memberUserIds.map((m) => m.userId)
        users = ids.length
          ? await prisma.user.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true, email: true },
              orderBy: { name: 'asc' },
            })
          : []
      } catch {
        users = []
      }
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json(
      { error: 'Benutzer konnten nicht geladen werden', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    let currentUser: { role: string; editionId: string | null; _count?: { ownedProjects: number } } | null = null
    try {
      currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, editionId: true, _count: { select: { ownedProjects: true } } },
      })
    } catch {
      currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, editionId: true },
      })
      if (currentUser) (currentUser as any)._count = { ownedProjects: 0 }
    }
    if (!currentUser) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 401 })
    }
    const isAdmin = currentUser.role === 'ADMIN'
    let ownedProjectsCount = currentUser._count?.ownedProjects ?? 0
    if (!isAdmin && !currentUser.editionId && ownedProjectsCount === 0) {
      try {
        const rows = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM "projects" WHERE "ownerId" = ${userId}
        `
        ownedProjectsCount = Number(rows[0]?.count ?? 0)
      } catch {
        // projects-Tabelle fehlt evtl.
      }
    }
    const isMainUser = isAdmin || !!currentUser.editionId || ownedProjectsCount > 0
    if (!isMainUser) {
      return NextResponse.json(
        { error: 'Nur Administrator oder Hauptbenutzer können neue Benutzer anlegen.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = userSchema.parse(body)
    // Nur Admin darf Hauptbenutzer ernennen (editionId setzen). Hauptbenutzer legen nur Projektmitarbeiter an (ohne Edition).
    const editionId = isAdmin ? ((body.editionId as string) || null) : null

    // Prüfe ob E-Mail bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'E-Mail-Adresse bereits vorhanden' },
        { status: 400 }
      )
    }

    // Erstelle neuen Benutzer: Admin kann Hauptbenutzer (mit editionId) oder Projektmitarbeiter anlegen; Hauptbenutzer nur Projektmitarbeiter
    const hashedPassword = await hashPassword(validatedData.password)
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: isAdmin ? ((validatedData.role as 'ADMIN' | 'COORDINATOR') || 'COORDINATOR') : 'COORDINATOR',
        editionId: editionId || undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        editionId: true,
        createdAt: true,
      },
    })

    // Neuer Hauptbenutzer: ausschließlich neue Listen / neue Gästeliste – keine Verbindung zu alten Projekten oder anderen Benutzern
    // Eigenes Projekt + eigenes leeres Event (leere Gästeliste, keine Aufgaben)
    if (editionId && user.id) {
      try {
        const project = await prisma.project.create({
          data: {
            ownerId: user.id,
            name: `Projekt ${validatedData.name}`,
          },
        })
        await prisma.event.create({
          data: {
            projectId: project.id,
            title: 'Mein Event',
            date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            location: '',
            description: null,
            status: 'PLANNING',
          },
        })
      } catch (e) {
        console.error('Default project/event for new main user could not be created:', e)
      }
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('User creation error:', error)
    return NextResponse.json(
      { error: 'Benutzer konnte nicht erstellt werden', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nur für Admin' }, { status: 403 })
    }

    const body = await request.json()
    const data = patchUserSchema.parse(body)

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.role !== undefined) updateData.role = data.role
    if (data.editionId !== undefined) updateData.editionId = data.editionId
    if (data.editionExpiresAt !== undefined) {
      updateData.editionExpiresAt = data.editionExpiresAt ? new Date(data.editionExpiresAt) : null
    }

    await prisma.user.update({
      where: { id: data.id },
      data: updateData,
    })

    if (data.categoryPermissions !== undefined) {
      await prisma.userCategoryPermission.deleteMany({ where: { userId: data.id } })
      for (const p of data.categoryPermissions) {
        await prisma.userCategoryPermission.create({
          data: { userId: data.id, categoryId: p.categoryId, allowed: p.allowed },
        })
      }
    }
    if (data.pagePermissions !== undefined) {
      await prisma.userPagePermission.deleteMany({ where: { userId: data.id } })
      for (const p of data.pagePermissions) {
        await prisma.userPagePermission.create({
          data: { userId: data.id, pageId: p.pageId, allowed: p.allowed },
        })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        editionId: true,
        editionExpiresAt: true,
        edition: { select: { id: true, code: true, name: true } },
        categoryPermissions: { select: { categoryId: true, allowed: true } },
        pagePermissions: { select: { pageId: true, allowed: true } },
      },
    })
    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }
    console.error('User PATCH error:', error)
    return NextResponse.json(
      { error: 'Benutzer konnte nicht aktualisiert werden' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Nur Admin darf Benutzer löschen.
 * Beim Löschen eines Hauptnutzers werden alle von ihm angelegten Projekte
 * und zugehörigen Projektmitarbeiter-Einträge kaskadiert mitgelöscht (Schema: onDelete Cascade).
 * Events dieser Projekte bleiben erhalten, projectId wird auf null gesetzt (SetNull).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nur Administratoren dürfen Benutzer löschen' }, { status: 403 })
    }

    const targetId = request.nextUrl.searchParams.get('id')?.trim()
    if (!targetId) {
      return NextResponse.json({ error: 'Parameter id fehlt' }, { status: 400 })
    }
    if (targetId === userId) {
      return NextResponse.json({ error: 'Sie können sich nicht selbst löschen' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (target.role === 'ADMIN' && adminCount <= 1) {
      return NextResponse.json(
        { error: 'Der letzte Administrator kann nicht gelöscht werden' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: targetId },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('User DELETE error:', error)
    return NextResponse.json(
      { error: 'Benutzer konnte nicht gelöscht werden', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
