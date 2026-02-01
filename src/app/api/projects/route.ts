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

/** Neues Projekt anlegen (Hauptaccount). Limit durch Edition (maxProjects). */
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        editionId: true,
        edition: { select: { maxProjects: true } },
        _count: { select: { ownedProjects: true } },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    // Admin: unbegrenzt. Sonst: Edition-Limit prüfen
    const maxProjects = user.role === 'ADMIN' ? 999 : (user.edition?.maxProjects ?? 1)
    if (user._count.ownedProjects >= maxProjects) {
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
    return NextResponse.json({ error: 'Projekt konnte nicht erstellt werden' }, { status: 500 })
  }
}
