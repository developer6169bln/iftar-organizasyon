import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getAllowListForUser } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { allowedPageIds, allowedCategoryIds, isAdmin, user } = await getAllowListForUser(userId)
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({
      user,
      allowedPageIds,
      allowedCategoryIds,
      isAdmin,
    })
  } catch (error) {
    console.error('GET /api/me error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Benutzerdaten' },
      { status: 500 }
    )
  }
}
