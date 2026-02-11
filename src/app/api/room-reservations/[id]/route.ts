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
  const reservation = await prisma.roomReservation.findUnique({ where: { id } })
  if (!reservation) {
    return NextResponse.json({ error: 'Reservierung nicht gefunden' }, { status: 404 })
  }

  await prisma.roomReservation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
