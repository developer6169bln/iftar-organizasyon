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

export type AllowListResult = {
  allowedPageIds: string[]
  allowedCategoryIds: string[]
  isAdmin: boolean
  user: { id: string; email: string; name: string; role: string; editionId: string | null; editionExpiresAt: Date | null } | null
  projectId?: string | null
  isProjectOwner?: boolean
}

/**
 * Welche Seiten und Kategorien ein User nutzen darf.
 * Ohne projectId: Hauptaccount-Logik (Edition + User-Overrides). Admin = alles.
 * Mit projectId: Wenn Owner des Projekts → Edition; wenn Projektmitarbeiter → nur vergebene Rechte; sonst leer.
 */
export async function getAllowListForUser(userId: string, projectId?: string | null): Promise<AllowListResult> {
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
      ownedProjects: { select: { id: true } },
      projectMemberships: {
        select: {
          projectId: true,
          categoryPermissions: { select: { categoryId: true, allowed: true } },
          pagePermissions: { select: { pageId: true, allowed: true } },
        },
      },
    },
  })

  if (!user) {
    return { allowedPageIds: [], allowedCategoryIds: [], isAdmin: false, user: null }
  }

  const isAdmin = user.role === 'ADMIN'
  const userPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    editionId: user.editionId,
    editionExpiresAt: user.editionExpiresAt,
  }

  // Projekt-Kontext: Berechtigungen für dieses Projekt
  if (projectId) {
    const isOwner = user.ownedProjects.some((p) => p.id === projectId)
    const membership = user.projectMemberships.find((m) => m.projectId === projectId)

    if (isAdmin) {
      const categories = await prisma.category.findMany({ select: { categoryId: true } })
      return {
        allowedPageIds: [...ALL_PAGE_IDS],
        allowedCategoryIds: categories.map((c) => c.categoryId),
        isAdmin: true,
        user: userPayload,
        projectId,
        isProjectOwner: true,
      }
    }
    if (isOwner) {
      // Owner: Edition + User-Overrides (wie bisher)
      if (!user.editionId || !user.edition) {
        const categories = await prisma.category.findMany({ select: { categoryId: true } })
        return {
          allowedPageIds: [...ALL_PAGE_IDS],
          allowedCategoryIds: categories.map((c) => c.categoryId),
          isAdmin: false,
          user: userPayload,
          projectId,
          isProjectOwner: true,
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
        user: userPayload,
        projectId,
        isProjectOwner: true,
      }
    }
    if (membership) {
      // Projektmitarbeiter: nur vergebene Kategorien/Seiten
      const allowedPageIds = membership.pagePermissions.filter((p) => p.allowed).map((p) => p.pageId)
      const allowedCategoryIds = membership.categoryPermissions.filter((c) => c.allowed).map((c) => c.categoryId)
      return {
        allowedPageIds,
        allowedCategoryIds,
        isAdmin: false,
        user: userPayload,
        projectId,
        isProjectOwner: false,
      }
    }
    return { allowedPageIds: [], allowedCategoryIds: [], isAdmin: false, user: userPayload, projectId, isProjectOwner: false }
  }

  // Ohne projectId: bisherige Logik (Hauptaccount / Rückwärtskompatibilität)
  if (isAdmin) {
    const categories = await prisma.category.findMany({ select: { categoryId: true } })
    return {
      allowedPageIds: [...ALL_PAGE_IDS],
      allowedCategoryIds: categories.map((c) => c.categoryId),
      isAdmin: true,
      user: userPayload,
    }
  }

  if (!user.editionId || !user.edition) {
    const categories = await prisma.category.findMany({ select: { categoryId: true } })
    return {
      allowedPageIds: [...ALL_PAGE_IDS],
      allowedCategoryIds: categories.map((c) => c.categoryId),
      isAdmin: false,
      user: userPayload,
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
    user: userPayload,
  }
}

/** Projekte, die der User besitzt oder in denen er Mitglied ist. */
export async function getProjectsForUser(userId: string): Promise<{ id: string; name: string; ownerId: string; isOwner: boolean }[]> {
  const owned = await prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, ownerId: true },
  })
  const asMember = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true, project: { select: { id: true, name: true, ownerId: true } } },
  })
  return [
    ...owned.map((p) => ({ id: p.id, name: p.name, ownerId: p.ownerId, isOwner: true })),
    ...asMember.map((m) => ({ id: m.project.id, name: m.project.name, ownerId: m.project.ownerId, isOwner: false })),
  ]
}

export function canAccessPage(allowedPageIds: string[], pageId: string): boolean {
  return allowedPageIds.includes(pageId)
}

export function canAccessCategory(allowedCategoryIds: string[], categoryId: string): boolean {
  return allowedCategoryIds.includes(categoryId)
}

/**
 * Prüft in API-Routen: User angemeldet und hat Zugriff auf die Seite.
 * projectId optional: wenn gesetzt, werden Berechtigungen im Projekt-Kontext geprüft.
 */
export async function requirePageAccess(
  request: NextRequest,
  pageId: string,
  projectId?: string | null
): Promise<{ userId: string; projectId?: string | null } | NextResponse> {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const { allowedPageIds, allowedCategoryIds, isAdmin } = await getAllowListForUser(userId, projectId)
  const hasPage = allowedPageIds.includes(pageId)
  const hasCategoryForPage =
    (pageId === 'guests' && allowedCategoryIds.includes('GUEST_LIST')) ||
    (pageId === 'program_flow' && allowedCategoryIds.includes('PROGRAM_FLOW'))
  if (isAdmin || hasPage || hasCategoryForPage) {
    return { userId, projectId: projectId ?? undefined }
  }
  return NextResponse.json({ error: 'Kein Zugriff auf diesen Bereich' }, { status: 403 })
}

/**
 * Prüft in API-Routen: User angemeldet und hat Zugriff auf die Kategorie.
 * projectId optional: wenn gesetzt, werden Berechtigungen im Projekt-Kontext geprüft.
 */
export async function requireCategoryAccess(
  request: NextRequest,
  categoryId: string,
  projectId?: string | null
): Promise<{ userId: string; projectId?: string | null } | NextResponse> {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const { allowedCategoryIds, isAdmin } = await getAllowListForUser(userId, projectId)
  if (isAdmin || allowedCategoryIds.includes(categoryId)) {
    return { userId, projectId: projectId ?? undefined }
  }
  return NextResponse.json({ error: 'Kein Zugriff auf diesen Bereich' }, { status: 403 })
}
