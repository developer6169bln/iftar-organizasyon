import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

/** Spalten in der Gästeliste, deren letzte Änderungen aus dem Audit-Log zurückgesetzt werden. */
const REVERT_COLUMN_KEYS = [
  'Zusage',
  'Absage',
  'Nimmt teil',
  'Nimmt nicht teil',
  'Einladungsliste',
]

/**
 * POST – In der Gästeliste gemachte Änderungen an Zusage, Absage, Nimmt teil, Nimmt nicht teil, Einladungsliste
 * anhand des Audit-Logs auf den vorherigen Stand zurücksetzen.
 * Nutzt die letzten GUEST-UPDATE-Einträge pro Gast und stellt oldValues.additionalData (nur diese Keys) wieder her.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.eventId as string
    const sinceHours = typeof body.sinceHours === 'number' ? body.sinceHours : 24 * 7 // Standard: letzte 7 Tage

    if (!eventId) {
      return NextResponse.json({ error: 'eventId ist erforderlich' }, { status: 400 })
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'GUEST',
        action: 'UPDATE',
        eventId,
        createdAt: { gte: since },
        oldValues: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Pro Gast nur den neuesten Eintrag (erster bei desc = letzte Änderung)
    const latestByGuest = new Map<string, { oldValues: any }>()
    for (const log of logs) {
      if (!log.entityId || latestByGuest.has(log.entityId)) continue
      try {
        const oldValues = log.oldValues ? JSON.parse(log.oldValues) : null
        if (oldValues && typeof oldValues === 'object') latestByGuest.set(log.entityId, { oldValues })
      } catch {
        // ignore
      }
    }

    if (latestByGuest.size === 0) {
      return NextResponse.json({
        message: 'Keine zurückzusetzenden Änderungen in den Spalten Zusage, Absage, Nimmt teil, Nimmt nicht teil, Einladungsliste gefunden (keine passenden Einträge im Audit-Log).',
        reverted: 0,
      })
    }

    const guestIds = Array.from(latestByGuest.keys())
    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId },
      select: { id: true, additionalData: true },
    })

    let reverted = 0
    for (const guest of guests) {
      const entry = latestByGuest.get(guest.id)
      if (!entry?.oldValues) continue

      let oldAdd: Record<string, unknown> = {}
      try {
        if (entry.oldValues.additionalData) {
          const parsed =
            typeof entry.oldValues.additionalData === 'string'
              ? JSON.parse(entry.oldValues.additionalData)
              : entry.oldValues.additionalData
          if (parsed && typeof parsed === 'object') oldAdd = parsed
        }
      } catch {
        continue
      }

      let currentAdd: Record<string, unknown> = {}
      if (guest.additionalData) {
        try {
          currentAdd = JSON.parse(guest.additionalData) as Record<string, unknown>
        } catch {
          continue
        }
      }

      let changed = false
      for (const key of REVERT_COLUMN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(oldAdd, key)) {
          currentAdd[key] = oldAdd[key]
          changed = true
        }
      }
      if (!changed) continue

      await prisma.guest.update({
        where: { id: guest.id },
        data: { additionalData: JSON.stringify(currentAdd) },
      })
      reverted++
    }

    return NextResponse.json({
      message: `${reverted} Gast/Gäste: Spalten Zusage, Absage, Nimmt teil, Nimmt nicht teil und Einladungsliste auf den vorherigen Stand zurückgesetzt.`,
      reverted,
    })
  } catch (error) {
    console.error('revert-column-changes error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Fehler beim Zurücksetzen der Spaltenänderungen', details: msg },
      { status: 500 }
    )
  }
}
