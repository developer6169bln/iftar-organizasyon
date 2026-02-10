import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { requirePageAccess } from '@/lib/permissions'

/** Liste der Hauptnutzer (User mit editionId = Hauptaccount) für Dropdowns z. B. bei Raum-Reservierungen. */
export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'room-reservations')
  if (access instanceof NextResponse) return access
  const users = await prisma.user.findMany({
    where: { editionId: { not: null } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}
