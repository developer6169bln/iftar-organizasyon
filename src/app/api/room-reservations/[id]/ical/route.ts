import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Reservierung als .ics Kalenderdatei (öffentlich, für WhatsApp-Teilung). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const r = await prisma.roomReservation.findUnique({
    where: { id },
    include: {
      room: { select: { name: true } },
    },
  })

  if (!r) {
    return NextResponse.json({ error: 'Reservierung nicht gefunden' }, { status: 404 })
  }

  const start = new Date(r.startAt)
  const end = r.endAt ? new Date(r.endAt) : new Date(start.getTime() + 60 * 60 * 1000)

  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const dtStart = formatIcsDate(start)
  const dtEnd = formatIcsDate(end)
  const now = formatIcsDate(new Date())

  const escapeIcs = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const summary = escapeIcs(r.title)
  const location = escapeIcs(r.room.name)
  const description = r.notes ? escapeIcs(r.notes) : `Raumreservierung: ${r.room.name}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Raumreservierung//DE',
    'BEGIN:VEVENT',
    `UID:${r.id}@room-reservation`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservierung-${r.id.slice(0, 8)}.ics"`,
    },
  })
}
