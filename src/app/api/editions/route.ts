import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getUserIdFromRequest } from '@/lib/auditLog'

const patchEditionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  annualPriceCents: z.number().int().min(0).optional(),
  categoryIds: z.array(z.string()).optional(),
  pageIds: z.array(z.string()).optional(),
})

/** GET /api/editions – alle Editionen mit Kategorien und Seiten. */
export async function GET(_request: NextRequest) {
  try {
    const editions = await prisma.edition.findMany({
      orderBy: { order: 'asc' },
      include: {
        categories: { select: { categoryId: true } },
        pages: { select: { pageId: true } },
      },
    })
    return NextResponse.json(
      editions.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        annualPriceCents: e.annualPriceCents,
        order: e.order,
        categoryIds: (e.categories ?? []).map((c) => c.categoryId),
        pageIds: (e.pages ?? []).map((p) => p.pageId),
      }))
    )
  } catch (error) {
    console.error('Editions GET error:', error)
    const msg = error instanceof Error ? error.message : 'Editionen konnten nicht geladen werden'
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}

/** PATCH /api/editions – Edition bearbeiten (nur Admin): Name, Preis, Kategorien, Seiten. */
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
    const data = patchEditionSchema.parse(body)

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.annualPriceCents !== undefined) updateData.annualPriceCents = data.annualPriceCents

    if (Object.keys(updateData).length > 0) {
      await prisma.edition.update({
        where: { id: data.id },
        data: updateData,
      })
    }

    if (data.categoryIds !== undefined) {
      const uniqueCategoryIds = [...new Set(data.categoryIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      await prisma.editionCategory.deleteMany({ where: { editionId: data.id } })
      for (const categoryId of uniqueCategoryIds) {
        await prisma.editionCategory.create({
          data: { editionId: data.id, categoryId },
        })
      }
    }
    if (data.pageIds !== undefined) {
      const uniquePageIds = [...new Set(data.pageIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      await prisma.editionPage.deleteMany({ where: { editionId: data.id } })
      for (const pageId of uniquePageIds) {
        await prisma.editionPage.create({
          data: { editionId: data.id, pageId },
        })
      }
    }

    const edition = await prisma.edition.findUnique({
      where: { id: data.id },
      include: {
        categories: { select: { categoryId: true } },
        pages: { select: { pageId: true } },
      },
    })
    return NextResponse.json({
      id: edition!.id,
      code: edition!.code,
      name: edition!.name,
      annualPriceCents: edition!.annualPriceCents,
      order: edition!.order,
      categoryIds: edition!.categories.map((c) => c.categoryId),
      pageIds: edition!.pages.map((p) => p.pageId),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }
    console.error('Edition PATCH error:', error)
    return NextResponse.json(
      { error: 'Edition konnte nicht aktualisiert werden' },
      { status: 500 }
    )
  }
}
