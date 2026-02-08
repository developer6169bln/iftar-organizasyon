import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

/**
 * GET: Liste der Hauptbenutzer (editionId gesetzt), die als Partner bei Projekterstellung auswählbar sind.
 * Nur für angemeldete Nutzer, die selbst Projekte anlegen können (Admin oder Hauptnutzer mit Edition).
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, editionId: true },
    })
    const isAdmin = me?.role === 'ADMIN'
    const isMainUser = !!me?.editionId
    if (!isAdmin && !isMainUser) {
      return NextResponse.json(
        { error: 'Nur Administratoren oder Hauptbenutzer können Partner auswählen' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      where: {
        editionId: { not: null },
        id: { not: userId },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('GET /api/users/available-partners error:', error)
    return NextResponse.json(
      { error: 'Partnerliste konnte nicht geladen werden' },
      { status: 500 }
    )
  }
}
