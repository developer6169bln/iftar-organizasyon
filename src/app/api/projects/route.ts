import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { getProjectsForUser } from '@/lib/permissions'

/** Liste meiner Projekte (als Owner oder Mitglied). */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const projects = await getProjectsForUser(userId)
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Projekte konnten nicht geladen werden' }, { status: 500 })
  }
}

/** Neues Projekt anlegen (nur Admin oder Hauptnutzer mit Edition). Limit durch Edition (maxProjects). */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Projektname ist erforderlich' }, { status: 400 })
    }

    let user: { role: string; editionId: string | null; edition?: { maxProjects: number } | null; ownedCount?: number } | null = null
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          editionId: true,
          edition: { select: { maxProjects: true } },
          _count: { select: { ownedProjects: true } },
        },
      })
      if (u) {
        user = {
          role: u.role,
          editionId: u.editionId,
          edition: u.edition,
          ownedCount: u._count?.ownedProjects ?? 0,
        }
      }
    } catch (err) {
      console.error('POST /api/projects user lookup:', err)
      return NextResponse.json({ error: 'Benutzer konnte nicht geladen werden' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    // Nur Admin oder Hauptnutzer (mit Edition) dürfen Projekte anlegen
    if (user.role !== 'ADMIN' && !user.editionId) {
      return NextResponse.json(
        { error: 'Nur Administratoren oder Hauptnutzer können Projekte anlegen.' },
        { status: 403 }
      )
    }

    const maxProjects = user.role === 'ADMIN' ? 999 : (user.edition?.maxProjects ?? 1)
    if ((user.ownedCount ?? 0) >= maxProjects) {
      return NextResponse.json(
        { error: `Maximale Anzahl Projekte (${maxProjects}) erreicht. Bitte Edition erweitern.` },
        { status: 403 }
      )
    }

    const project = await prisma.project.create({
      data: { ownerId: userId, name },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Projekt konnte nicht erstellt werden', details: msg },
      { status: 500 }
    )
  }
}
