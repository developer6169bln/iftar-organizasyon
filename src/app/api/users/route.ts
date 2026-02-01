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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, ownedProjects: { take: 1, select: { id: true } } },
    })
    const isAdmin = currentUser?.role === 'ADMIN'
    const isProjectOwner = (currentUser?.ownedProjects?.length ?? 0) > 0
    if (!isAdmin && !isProjectOwner) {
      return NextResponse.json({ error: 'Nur für Admin oder Projektinhaber' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: isAdmin
        ? {
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
          }
        : { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json(
      { error: 'Benutzer konnten nicht geladen werden' },
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
      return NextResponse.json({ error: 'Benutzer konnte nicht geprüft werden' }, { status: 500 })
    }
    const isAdmin = currentUser?.role === 'ADMIN'
    const isMainUser = isAdmin || !!currentUser?.editionId || (currentUser?._count?.ownedProjects ?? 0) > 0
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
        edition: { select: { id: true, code: true, name: true } },
        createdAt: true,
      },
    })

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
      { error: 'Benutzer konnte nicht erstellt werden' },
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
