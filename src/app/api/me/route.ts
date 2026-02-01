import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getAllowListForUser, getProjectsForUser } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId') || undefined
    let allowList: Awaited<ReturnType<typeof getAllowListForUser>>
    let projects: Awaited<ReturnType<typeof getProjectsForUser>> = []

    try {
      ;[allowList, projects] = await Promise.all([
        getAllowListForUser(userId, projectId || null),
        getProjectsForUser(userId),
      ])
    } catch (err) {
      console.error('GET /api/me allowList/projects error:', err)
      allowList = await getAllowListForUser(userId, null)
      projects = []
    }

    const { allowedPageIds, allowedCategoryIds, isAdmin, user, isProjectOwner } = allowList
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({
      user,
      allowedPageIds: allowedPageIds ?? [],
      allowedCategoryIds: allowedCategoryIds ?? [],
      isAdmin: !!isAdmin,
      projects,
      projectId: projectId || null,
      isProjectOwner: isProjectOwner ?? null,
    })
  } catch (error) {
    console.error('GET /api/me error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Benutzerdaten' },
      { status: 500 }
    )
  }
}
