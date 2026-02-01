import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { getUserIdFromRequest } from './auditLog'

export const ALL_PAGE_IDS = [
  'invitations',
  'checkin',
  'reports',
  'audit-logs',
  'push-notifications',
  'vip-namensschilder',
  'tischplanung',
  'guests',
  'program_flow',
] as const

export type PageId = (typeof ALL_PAGE_IDS)[number]

/** Welche Seiten und Kategorien ein User nutzen darf (Edition + User-Overrides). Admin = alles. */
export async function getAllowListForUser(userId: string): Promise<{
  allowedPageIds: string[]
  allowedCategoryIds: string[]
  isAdmin: boolean
  user: { id: string; email: string; name: string; role: string; editionId: string | null; editionExpiresAt: Date | null } | null
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      editionId: true,
      editionExpiresAt: true,
      edition: {
        select: {
          id: true,
          pages: { select: { pageId: true } },
          categories: { select: { categoryId: true } },
        },
      },
      pagePermissions: { select: { pageId: true, allowed: true } },
      categoryPermissions: { select: { categoryId: true, allowed: true } },
    },
  })

  if (!user) {
    return { allowedPageIds: [], allowedCategoryIds: [], isAdmin: false, user: null }
  }

  const isAdmin = user.role === 'ADMIN'
  if (isAdmin) {
    const categories = await prisma.category.findMany({ select: { categoryId: true } })
    return {
      allowedPageIds: [...ALL_PAGE_IDS],
      allowedCategoryIds: categories.map((c) => c.categoryId),
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        editionId: user.editionId,
        editionExpiresAt: user.editionExpiresAt,
      },
    }
  }

  // Keine Edition = Rückwärtskompatibilität: alles erlauben
  if (!user.editionId || !user.edition) {
    const categories = await prisma.category.findMany({ select: { categoryId: true } })
    return {
      allowedPageIds: [...ALL_PAGE_IDS],
      allowedCategoryIds: categories.map((c) => c.categoryId),
      isAdmin: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        editionId: user.editionId,
        editionExpiresAt: user.editionExpiresAt,
      },
    }
  }

  let allowedPageIds = user.edition.pages.map((p) => p.pageId)
  let allowedCategoryIds = user.edition.categories.map((c) => c.categoryId)

  for (const perm of user.pagePermissions) {
    if (perm.allowed) {
      if (!allowedPageIds.includes(perm.pageId)) allowedPageIds.push(perm.pageId)
    } else {
      allowedPageIds = allowedPageIds.filter((id) => id !== perm.pageId)
    }
  }
  for (const perm of user.categoryPermissions) {
    if (perm.allowed) {
      if (!allowedCategoryIds.includes(perm.categoryId)) allowedCategoryIds.push(perm.categoryId)
    } else {
      allowedCategoryIds = allowedCategoryIds.filter((id) => id !== perm.categoryId)
    }
  }

  return {
    allowedPageIds,
    allowedCategoryIds,
    isAdmin: false,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      editionId: user.editionId,
      editionExpiresAt: user.editionExpiresAt,
    },
  }
}

export function canAccessPage(allowedPageIds: string[], pageId: string): boolean {
  return allowedPageIds.includes(pageId)
}

export function canAccessCategory(allowedCategoryIds: string[], categoryId: string): boolean {
  return allowedCategoryIds.includes(categoryId)
}

/**
 * Prüft in API-Routen: User angemeldet und hat Zugriff auf die Seite.
 * Bei Fehler: 401/403 NextResponse, sonst { userId }.
 */
export async function requirePageAccess(
  request: NextRequest,
  pageId: string
): Promise<{ userId: string } | NextResponse> {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const { allowedPageIds, isAdmin } = await getAllowListForUser(userId)
  if (isAdmin || allowedPageIds.length === 0 || allowedPageIds.includes(pageId)) {
    return { userId }
  }
  return NextResponse.json({ error: 'Kein Zugriff auf diesen Bereich' }, { status: 403 })
}

/**
 * Prüft in API-Routen: User angemeldet und hat Zugriff auf die Kategorie.
 */
export async function requireCategoryAccess(
  request: NextRequest,
  categoryId: string
): Promise<{ userId: string } | NextResponse> {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const { allowedCategoryIds, isAdmin } = await getAllowListForUser(userId)
  if (isAdmin || allowedCategoryIds.length === 0 || allowedCategoryIds.includes(categoryId)) {
    return { userId }
  }
  return NextResponse.json({ error: 'Kein Zugriff auf diesen Bereich' }, { status: 403 })
}
