import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, getProjectsForUser } from '@/lib/permissions'

/** Reservierung löschen (Datum freigeben). Nur Admin oder Hauptbenutzer. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access

  const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { role: true } })
  const projects = await getProjectsForUser(access.userId)
  const isAdmin = user?.role === 'ADMIN'
  const isHauptbenutzer =
    projects.some((p) => p.isOwner) ||
    (await prisma.user.findUnique({ where: { id: access.userId }, select: { editionId: true } }))?.editionId != null

  if (!isAdmin && !isHauptbenutzer) {
    return NextResponse.json(
      { error: 'Nur Admin oder Hauptbenutzer können Reservierungen löschen (Datum freigeben).' },
      { status: 403 }
    )
  }

  const { id } = await params

  try {
    await prisma.roomReservation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)

    // Wenn die Tabelle/Spalten im Zielsystem noch nicht migriert sind, per Raw-DELETE versuchen
    if (msg.includes('responsibleUserId') || msg.includes('eventLeaderId') || msg.includes('does not exist') || msg.includes('room_reservations')) {
      try {
        await prisma.$executeRawUnsafe('DELETE FROM "room_reservations" WHERE id = $1', id)
        return NextResponse.json({ ok: true })
      } catch (e2: unknown) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2)
        return NextResponse.json(
          {
            error: `Reservierung konnte nicht gelöscht werden (Migration fehlt?): ${msg2}. Bitte Datenbank-Migration ausführen (z. B. npx prisma migrate deploy).`,
          },
          { status: 500 }
        )
      }
    }

    if (msg.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Reservierung nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json(
      { error: `Reservierung konnte nicht gelöscht werden: ${msg}` },
      { status: 500 }
    )
  }
}
