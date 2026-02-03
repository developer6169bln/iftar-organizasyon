import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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
    const eventTitle = typeof body.eventTitle === 'string' ? body.eventTitle.trim() : ''
    const eventDateRaw = body.eventDate
    const eventLocation = typeof body.eventLocation === 'string' ? body.eventLocation.trim() : ''
    const eventDescription = typeof body.eventDescription === 'string' ? body.eventDescription.trim() || null : null

    if (!name) {
      return NextResponse.json({ error: 'Projektname ist erforderlich' }, { status: 400 })
    }
    if (!eventTitle) {
      return NextResponse.json({ error: 'Event-Titel ist erforderlich (Wann und unter welchem Titel findet das Event statt?).' }, { status: 400 })
    }
    if (!eventLocation) {
      return NextResponse.json({ error: 'Event-Ort ist erforderlich (Wo findet das Event statt?).' }, { status: 400 })
    }
    const eventDate = eventDateRaw ? new Date(eventDateRaw) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: 'Ungültiges Event-Datum.' }, { status: 400 })
    }

    // User nur role + editionId (per Raw-SQL, damit projects-Tabelle/Relation nicht nötig ist)
    let u: { role: string; editionId: string | null } | null = null
    try {
      const rows = await prisma.$queryRaw<{ role: string; editionId: string | null }[]>`
        SELECT "role", "editionId" FROM "users" WHERE "id" = ${userId} LIMIT 1
      `
      u = rows[0] ?? null
    } catch (userErr) {
      console.error('POST /api/projects user lookup:', userErr)
      return NextResponse.json(
        { error: 'Benutzerdaten konnten nicht gelesen werden.', details: userErr instanceof Error ? userErr.message : String(userErr) },
        { status: 500 }
      )
    }
    if (!u) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    // Nur Admin oder Hauptnutzer (mit Edition) dürfen Projekte anlegen
    if (u.role !== 'ADMIN' && !u.editionId) {
      return NextResponse.json(
        { error: 'Nur Administratoren oder Hauptnutzer können Projekte anlegen.' },
        { status: 403 }
      )
    }

    // maxProjects aus Edition (falls Spalte fehlt → 1)
    let maxProjects = 1
    if (u.role === 'ADMIN') {
      maxProjects = 999
    } else if (u.editionId) {
      try {
        const edition = await prisma.edition.findUnique({
          where: { id: u.editionId },
          select: { maxProjects: true },
        })
        if (edition?.maxProjects != null) maxProjects = edition.maxProjects
      } catch {
        // Spalte maxProjects fehlt evtl. → 1
      }
    }

    // Anzahl eigener Projekte separat (robust, wenn Tabelle fehlt → 0)
    let ownedCount = 0
    try {
      ownedCount = await prisma.project.count({ where: { ownerId: userId } })
    } catch {
      // Tabelle projects fehlt evtl. → 0, create wird danach ggf. 500 mit klarer Meldung
    }
    if (ownedCount >= maxProjects) {
      return NextResponse.json(
        { error: `Maximale Anzahl Projekte (${maxProjects}) erreicht. Bitte Edition erweitern.` },
        { status: 403 }
      )
    }

    // Raw-SQL: INSERT mit RETURNING (ein Befehl, Zeile wird sofort zurückgegeben)
    const id = randomUUID()
    let project: { id: string; ownerId: string; name: string; createdAt: Date; updatedAt: Date }
    try {
      const rows = await prisma.$queryRaw<{ id: string; ownerId: string; name: string; createdAt: Date; updatedAt: Date }[]>`
        INSERT INTO "projects" ("id", "ownerId", "name", "createdAt", "updatedAt")
        VALUES (${id}, ${userId}, ${name}, NOW(), NOW())
        RETURNING "id", "ownerId", "name", "createdAt", "updatedAt"
      `
      const row = rows[0]
      if (!row) {
        return NextResponse.json(
          { error: 'Projekt wurde nicht gespeichert.', details: 'INSERT RETURNING lieferte keine Zeile.' },
          { status: 500 }
        )
      }
      project = row
    } catch (insertErr) {
      const insertMsg = insertErr instanceof Error ? insertErr.message : String(insertErr)
      console.error('POST /api/projects INSERT error:', insertErr)
      return NextResponse.json(
        {
          error: 'Projekt konnte nicht erstellt werden.',
          details: insertMsg,
          hint: insertMsg.toLowerCase().includes('exist') || insertMsg.toLowerCase().includes('relation')
            ? 'Tabelle "projects" fehlt. Bitte auf Railway (Postgres → Query) RAILWAY_PROJEKTE_EINMAL.sql ausführen.'
            : undefined,
        },
        { status: 500 }
      )
    }

    // Jedes Projekt hat ein Event (Einladungen gelten für dieses Event): Event anlegen
    try {
      const hasProjectId = await prisma.$queryRaw<{ count: number }[]>`
        SELECT 1 as count FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'projectId'
        LIMIT 1
      `.then((r) => (r?.length ?? 0) > 0)
      if (hasProjectId) {
        await prisma.event.create({
          data: {
            projectId: project.id,
            title: eventTitle,
            date: eventDate,
            location: eventLocation,
            description: eventDescription,
            status: 'PLANNING',
          },
        })
      }
    } catch (eventErr) {
      console.error('POST /api/projects Event create error:', eventErr)
      // Projekt wurde erstellt; Event fehlgeschlagen (z. B. Spalte projectId fehlt) – Projekt trotzdem zurückgeben
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const code = error && typeof (error as any).code === 'string' ? (error as any).code : ''
    return NextResponse.json(
      {
        error: 'Projekt konnte nicht erstellt werden',
        details: msg,
        ...(code ? { code } : {}),
      },
      { status: 500 }
    )
  }
}
