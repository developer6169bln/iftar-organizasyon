import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getAllowListForUser } from '@/lib/permissions'

async function requireOwnerOrAdmin(request: NextRequest, projectId: string) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const allow = await getAllowListForUser(userId, projectId)
  if (!allow.isAdmin && !allow.isProjectOwner) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  return { userId }
}

// GET: Projekt-spezifische Kategorie-Einstellungen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const access = await requireOwnerOrAdmin(request, projectId)
  if (access instanceof NextResponse) return access

  const settings = await prisma.projectCategorySetting.findMany({
    where: { projectId },
    include: {
      responsibleUser: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json(settings)
}

// PATCH: Upsert einer Kategorie-Einstellung (Beschreibung/Verantwortlicher) für dieses Projekt
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const access = await requireOwnerOrAdmin(request, projectId)
  if (access instanceof NextResponse) return access

  const body = await request.json().catch(() => ({}))
  const categoryId = body.categoryId ? String(body.categoryId).trim() : ''
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId erforderlich' }, { status: 400 })
  }

  const description =
    body.description !== undefined ? (String(body.description).trim() || null) : undefined
  const responsibleUserId =
    body.responsibleUserId !== undefined
      ? (String(body.responsibleUserId).trim() || null)
      : undefined

  // Wenn beide Felder explizit geleert werden: Setting löschen
  if (description === null && responsibleUserId === null) {
    await prisma.projectCategorySetting
      .delete({
        where: {
          projectId_categoryId: { projectId, categoryId },
        },
      })
      .catch(() => {})
    return NextResponse.json({ success: true, deleted: true })
  }

  const updated = await prisma.projectCategorySetting.upsert({
    where: {
      projectId_categoryId: { projectId, categoryId },
    },
    create: {
      projectId,
      categoryId,
      description: description === undefined ? null : description,
      responsibleUserId: responsibleUserId === undefined ? null : responsibleUserId,
    },
    update: {
      ...(description !== undefined ? { description } : {}),
      ...(responsibleUserId !== undefined ? { responsibleUserId } : {}),
    },
    include: {
      responsibleUser: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ success: true, setting: updated })
}

