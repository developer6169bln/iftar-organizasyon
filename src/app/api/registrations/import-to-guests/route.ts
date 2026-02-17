import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { logCreate, getUserIdFromRequest } from '@/lib/auditLog'

const ALL_SLUGS = [
  'uid-iftar',
  'sube-baskanlari',
  'kadin-kollari',
  'genclik-kollari',
  'fatihgruppe',
  'omerliste',
  'kemalettingruppe',
]

/**
 * POST – Anmeldungen in die Gästeliste übernehmen.
 * Body: { eventSlug: string, eventId: string } oder { eventSlug: 'all', eventId: string }
 * Bei eventSlug: 'all' werden alle Listen zusammengeführt (Duplikate nach Vorname+Name zusammengefasst).
 * Duplikat-Prüfung: Name (Vorname + Nachname) – bei vorhandenem Namen wird übersprungen.
 */
export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const body = await request.json()
    const { eventSlug, eventId } = body

    if (!eventSlug || !eventId) {
      return NextResponse.json(
        { error: 'eventSlug und eventId sind erforderlich' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    let registrations: Awaited<ReturnType<typeof prisma.eventRegistration.findMany>>

    if (eventSlug === 'all') {
      const all = await prisma.eventRegistration.findMany({
        where: { eventSlug: { in: ALL_SLUGS } },
        orderBy: { createdAt: 'asc' },
      })
      const key = (r: { firstName: string | null; lastName: string | null }) =>
        `${(r.firstName || '').trim().toLowerCase()}|${(r.lastName || '').trim().toLowerCase()}`
      const groups = new Map<string, typeof all>()
      for (const r of all) {
        const k = key(r)
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k)!.push(r)
      }
      registrations = Array.from(groups.values()).map((regs) =>
        regs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
      )
    } else {
      registrations = await prisma.eventRegistration.findMany({
        where: { eventSlug },
        orderBy: { createdAt: 'asc' },
      })
    }

    const existingGuests = await prisma.guest.findMany({
      where: { eventId },
      select: { id: true, name: true },
    })

    const existingNamesLower = new Set(
      existingGuests.map((g) => (g.name || '').trim().toLowerCase()).filter(Boolean)
    )

    let imported = 0
    const duplicateNames: string[] = []

    for (const reg of registrations) {
      const fullName = [reg.firstName, reg.lastName].filter(Boolean).join(' ').trim()
      if (!fullName) continue

      const nameLower = fullName.toLowerCase()
      if (existingNamesLower.has(nameLower)) {
        duplicateNames.push(fullName)
        continue
      }

      const additionalData: Record<string, string> = {
        Vorname: reg.firstName?.trim() ?? '',
        Nachname: reg.lastName?.trim() ?? '',
      }
      if (reg.district) additionalData['Bezirk'] = reg.district
      if (reg.sube) additionalData['Şube'] = reg.sube
      if (reg.notes) additionalData['Notizen'] = reg.notes

      const guest = await prisma.guest.create({
        data: {
          eventId,
          name: fullName,
          email: reg.email || null,
          phone: reg.phone || null,
          notes: reg.notes || null,
          organization: reg.district || reg.sube || null,
          additionalData: JSON.stringify(additionalData),
          status: 'INVITED',
        },
      })

      existingNamesLower.add(nameLower)
      imported++

      const userInfo = await getUserIdFromRequest(request)
      await logCreate('GUEST', guest.id, guest, request, {
        userId: userInfo.userId,
        userEmail: userInfo.userEmail,
        eventId,
        description: `Gast "${fullName}" aus Anmeldung (${eventSlug === 'all' ? 'alle Listen' : eventSlug}) importiert`,
      })
    }

    return NextResponse.json({
      imported,
      skipped: duplicateNames.length,
      duplicateNames,
      total: registrations.length,
    })
  } catch (error) {
    console.error('Fehler beim Import der Anmeldungen:', error)
    return NextResponse.json(
      { error: 'Import fehlgeschlagen' },
      { status: 500 }
    )
  }
}
