import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getAllowListForUser } from '@/lib/permissions'

const categorySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  description: z.string().optional(),
  responsibleUserId: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // Wenn projectId gesetzt ist: nur Benutzer mit Projektzugriff dürfen die projektbezogenen Overrides sehen
    let settingsByCategoryId: Record<string, any> = {}
    if (projectId) {
      const { userId } = await getUserIdFromRequest(request)
      if (!userId) {
        return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
      }
      const allow = await getAllowListForUser(userId, projectId)
      const hasAnyAccess = allow.isAdmin || allow.isProjectOwner || (allow.allowedPageIds?.length ?? 0) > 0 || (allow.allowedCategoryIds?.length ?? 0) > 0
      if (!hasAnyAccess) {
        return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
      }
      const settings = await prisma.projectCategorySetting.findMany({
        where: { projectId },
        include: {
          responsibleUser: { select: { id: true, name: true, email: true } },
        },
      })
      settingsByCategoryId = Object.fromEntries(settings.map((s) => [s.categoryId, s]))
    }

    const categories = await prisma.category.findMany({
      include: {
        responsibleUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    })

    // Merge projektbezogene Overrides (Beschreibung/Verantwortlicher) in die Kategorien
    if (projectId) {
      const merged = categories.map((c) => {
        const s = settingsByCategoryId[c.categoryId]
        if (!s) return c
        const effectiveDescription = s.description !== null && s.description !== undefined ? s.description : c.description
        const effectiveResponsibleUserId =
          s.responsibleUserId !== null && s.responsibleUserId !== undefined ? s.responsibleUserId : c.responsibleUserId
        const effectiveResponsibleUser =
          s.responsibleUserId !== null && s.responsibleUserId !== undefined ? s.responsibleUser : c.responsibleUser
        return {
          ...c,
          description: effectiveDescription,
          responsibleUserId: effectiveResponsibleUserId,
          responsibleUser: effectiveResponsibleUser,
          projectSetting: { id: s.id, projectId: s.projectId, categoryId: s.categoryId },
        }
      })
      return NextResponse.json(merged)
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories fetch error:', error)
    return NextResponse.json(
      { error: 'Kategorien konnten nicht geladen werden' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = categorySchema.parse(body)

    // Prüfe ob categoryId bereits existiert
    const existing = await prisma.category.findUnique({
      where: { categoryId: validatedData.categoryId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Kategorie-ID bereits vorhanden' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: {
        categoryId: validatedData.categoryId,
        name: validatedData.name,
        icon: validatedData.icon,
        color: validatedData.color,
        description: validatedData.description,
        responsibleUserId: validatedData.responsibleUserId || undefined,
        order: validatedData.order || 0,
        isActive: validatedData.isActive !== undefined ? validatedData.isActive : true,
      },
      include: {
        responsibleUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('Category creation error:', error)
    return NextResponse.json(
      { error: 'Kategorie konnte nicht erstellt werden' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID erforderlich' },
        { status: 400 }
      )
    }

    const dataToUpdate: any = {}
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name
    if (updateData.icon !== undefined) dataToUpdate.icon = updateData.icon
    if (updateData.color !== undefined) dataToUpdate.color = updateData.color
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description || null
    if (updateData.responsibleUserId !== undefined) {
      dataToUpdate.responsibleUserId = updateData.responsibleUserId && updateData.responsibleUserId !== '' 
        ? updateData.responsibleUserId 
        : null
    }
    if (updateData.order !== undefined) dataToUpdate.order = updateData.order
    if (updateData.isActive !== undefined) dataToUpdate.isActive = updateData.isActive

    const category = await prisma.category.update({
      where: { id },
      data: dataToUpdate,
      include: {
        responsibleUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Category update error:', error)
    return NextResponse.json(
      { error: 'Kategorie konnte nicht aktualisiert werden' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID erforderlich' },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Kategorie gelöscht' })
  } catch (error) {
    console.error('Category deletion error:', error)
    return NextResponse.json(
      { error: 'Kategorie konnte nicht gelöscht werden' },
      { status: 500 }
    )
  }
}
