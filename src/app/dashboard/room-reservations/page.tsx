'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Room = { id: string; name: string; description?: string | null; _count?: { reservations: number } }
type MainUser = { id: string; name: string | null; email: string }
type Reservation = {
  id: string
  roomId: string
  room: { id: string; name: string }
  project?: { id: string; name: string } | null
  event?: { id: string; title: string; date: string } | null
  reservedBy: { id: string; name: string; email: string }
  responsibleUser?: { id: string; name: string | null; email: string } | null
  eventLeader?: { id: string; name: string | null; email: string } | null
  title: string
  startAt: string
  endAt: string | null
  notes: string | null
}

const ROOM_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
]

function getRoomColor(roomId: string): string {
  let n = 0
  for (let i = 0; i < roomId.length; i++) n = (n * 31 + roomId.charCodeAt(i)) >>> 0
  return ROOM_COLORS[n % ROOM_COLORS.length]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ReservationTooltip({
  reservation,
  x,
  y,
}: {
  reservation: Reservation
  x: number
  y: number
}) {
  return (
    <div
      className="fixed z-50 max-w-xs rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
      style={{ left: x + 12, top: y + 8 }}
    >
      <div className="text-xs font-medium text-gray-900">{reservation.title}</div>
      <div className="mt-1 text-xs text-gray-600">
        <span className="font-medium">{reservation.room.name}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {formatDateTime(reservation.startAt)} – {reservation.endAt ? formatDateTime(reservation.endAt) : '–'}
      </div>
      {reservation.project && (
        <div className="mt-0.5 text-xs text-gray-500">Projekt: {reservation.project.name}</div>
      )}
      {reservation.event && (
        <div className="text-xs text-gray-500">Event: {reservation.event.title}</div>
      )}
      {reservation.responsibleUser && (
        <div className="text-xs text-gray-500">Verantwortlich: {reservation.responsibleUser.name || reservation.responsibleUser.email}</div>
      )}
      {reservation.eventLeader && (
        <div className="text-xs text-gray-500">Leiter: {reservation.eventLeader.name || reservation.eventLeader.email}</div>
      )}
      <div className="mt-0.5 text-xs text-gray-400">Reserviert von: {reservation.reservedBy.name}</div>
      {reservation.notes && (
        <div className="mt-1 border-t border-gray-100 pt-1 text-xs text-gray-500">{reservation.notes}</div>
      )}
    </div>
  )
}

/** Prüft, ob [slotStart, slotEnd) eine bestehende Reservierung schneidet. */
function slotOverlapsReservation(
  slotStart: Date,
  slotEnd: Date,
  r: Reservation
) {
  const resStart = new Date(r.startAt).getTime()
  const resEnd = r.endAt ? new Date(r.endAt).getTime() : resStart + 60 * 60 * 1000
  return slotStart.getTime() < resEnd && slotEnd.getTime() > resStart
}

function slotToLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function RoomCalendar({
  roomReservations,
  selectedSlots,
  onToggleSlot,
}: {
  roomReservations: Reservation[]
  selectedSlots: { start: string; end: string }[]
  onToggleSlot: (startIso: string, endIso: string) => void
}) {
  const days: Date[] = []
  const startDay = new Date()
  startDay.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDay)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  const hours = Array.from({ length: 14 }, (_, i) => i + 8) // 8–21

  const isSlotSelected = (slotStart: Date, slotEnd: Date) =>
    selectedSlots.some((s) => s.start === slotToLocal(slotStart) && s.end === slotToLocal(slotEnd))

  return (
    <div>
      <p className="mb-2 text-xs text-gray-600">
        Gebuchte Zeiten sind rot. Klicken Sie auf freie Stunden, um mehrere Blöcke zu wählen (nochmal klicken zum Abwählen).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 p-1 font-medium">Uhrzeit</th>
              {days.map((d) => (
                <th key={d.toISOString()} className="border border-gray-300 bg-gray-100 p-1 font-medium">
                  {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border border-gray-300 bg-gray-50 p-1">{hour}:00</td>
                {days.map((day) => {
                  const slotStart = new Date(day)
                  slotStart.setHours(hour, 0, 0, 0)
                  const slotEnd = new Date(slotStart)
                  slotEnd.setHours(slotEnd.getHours() + 1, 0, 0, 0)
                  const busy = roomReservations.some((r) => slotOverlapsReservation(slotStart, slotEnd, r))
                  const selected = !busy && isSlotSelected(slotStart, slotEnd)
                  return (
                    <td key={day.toISOString() + hour} className="border border-gray-300 p-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (busy) return
                          onToggleSlot(slotToLocal(slotStart), slotToLocal(slotEnd))
                        }}
                        className={`block w-full py-2 text-center ${busy ? 'cursor-not-allowed bg-red-100 text-gray-500' : selected ? 'bg-green-200 text-green-800' : 'bg-white hover:bg-sky-50'}`}
                        title={busy ? 'Belegt' : selected ? 'Klick zum Abwählen' : `${slotStart.toLocaleString('de-DE')} wählen`}
                      >
                        {busy ? '–' : selected ? '✓' : '+'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Kalenderansicht: Räume als Zeilen, Tage als Spalten, Reservierungen als farbige Blöcke. */
function ReservationsCalendarView({
  reservations,
  onHoverReservation,
}: {
  reservations: Reservation[]
  onHoverReservation: (r: Reservation | null, e?: React.MouseEvent) => void
}) {
  const startDay = new Date()
  startDay.setHours(0, 0, 0, 0)
  const days: Date[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDay)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  const dayStart = days[0].getTime()
  const dayEnd = days[days.length - 1].getTime() + 24 * 60 * 60 * 1000
  const inRange = reservations.filter((r) => {
    const t = new Date(r.startAt).getTime()
    return t >= dayStart && t < dayEnd
  })
  const roomIds = Array.from(new Set(inRange.map((r) => r.roomId)))
  const hourMin = 8
  const hourMax = 22
  const hoursCount = hourMax - hourMin

  const getBlockStyle = (r: Reservation) => {
    const start = new Date(r.startAt).getTime()
    const end = r.endAt ? new Date(r.endAt).getTime() : start + 60 * 60 * 1000
    const dayIdx = Math.floor((start - dayStart) / (24 * 60 * 60 * 1000))
    if (dayIdx < 0 || dayIdx >= days.length) return null
    const dayStartMs = dayStart + dayIdx * 24 * 60 * 60 * 1000
    const cellStart = dayStartMs + hourMin * 60 * 60 * 1000
    const cellEnd = dayStartMs + hourMax * 60 * 60 * 1000
    const top = ((Math.max(start, cellStart) - cellStart) / (cellEnd - cellStart)) * 100
    const bottom = ((Math.min(end, cellEnd) - cellStart) / (cellEnd - cellStart)) * 100
    const height = Math.max(8, bottom - top)
    return { top: `${top}%`, height: `${height}%` }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-24 border border-gray-300 bg-gray-100 p-1 font-medium">Raum</th>
            {days.map((d) => (
              <th key={d.toISOString()} className="min-w-[4rem] border border-gray-300 bg-gray-100 p-1 font-medium">
                {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roomIds.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="border border-gray-200 px-2 py-4 text-center text-gray-500">
                Keine Reservierungen in den nächsten 14 Tagen
              </td>
            </tr>
          )}
          {roomIds.map((rid) => {
            const roomName = inRange.find((r) => r.roomId === rid)?.room.name ?? rid
            const roomRes = inRange.filter((r) => r.roomId === rid)
            return (
              <tr key={rid}>
                <td
                  className="sticky left-0 z-10 border border-gray-300 bg-gray-50 p-1 font-medium"
                  style={{ borderLeftWidth: 4, borderLeftColor: getRoomColor(rid) }}
                >
                  {roomName}
                </td>
                {days.map((day) => {
                  const dayStartMs = day.getTime()
                  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000
                  const cellRes = roomRes.filter((r) => {
                    const s = new Date(r.startAt).getTime()
                    const e = r.endAt ? new Date(r.endAt).getTime() : s + 60 * 60 * 1000
                    return s < dayEndMs && e > dayStartMs
                  })
                  return (
                    <td
                      key={day.toISOString()}
                      className="relative h-24 min-w-[4rem] border border-gray-200 bg-white align-top p-0"
                    >
                      <div className="relative h-full w-full">
                        {cellRes.map((r) => {
                          const style = getBlockStyle(r)
                          if (!style) return null
                          return (
                            <div
                              key={r.id}
                              className="absolute left-0.5 right-0.5 rounded px-0.5 py-px text-[10px] font-medium text-white shadow-sm overflow-hidden truncate"
                              style={{
                                ...style,
                                backgroundColor: getRoomColor(r.roomId),
                                opacity: 0.95,
                              }}
                              onMouseEnter={(e) => onHoverReservation(r, e)}
                              onMouseMove={(e) => onHoverReservation(r, e)}
                              onMouseLeave={() => onHoverReservation(null)}
                              title={r.title}
                            >
                              {r.title}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function RoomReservationsPage() {
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')
  const eventIdParam = searchParams.get('eventId')
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [events, setEvents] = useState<{ id: string; title: string; date: string; projectId: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [addingRoom, setAddingRoom] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [reservationRoomId, setReservationRoomId] = useState('')
  const [reservationTitle, setReservationTitle] = useState('')
  const [reservationStart, setReservationStart] = useState('')
  const [reservationEnd, setReservationEnd] = useState('')
  const [reservationNotes, setReservationNotes] = useState('')
  const [reservationProjectId, setReservationProjectId] = useState('')
  const [reservationEventId, setReservationEventId] = useState('')
  const [reservationResponsibleUserId, setReservationResponsibleUserId] = useState('')
  const [reservationEventLeaderId, setReservationEventLeaderId] = useState('')
  const [mainUsers, setMainUsers] = useState<MainUser[]>([])
  const [roomReservationsForCalendar, setRoomReservationsForCalendar] = useState<Reservation[]>([])
  const [showStartCalendar, setShowStartCalendar] = useState(false)
  const [reservationSlots, setReservationSlots] = useState<{ start: string; end: string }[]>([])
  const [savingReservation, setSavingReservation] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hoveredReservation, setHoveredReservation] = useState<Reservation | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleHoverReservation = (r: Reservation | null, e?: React.MouseEvent) => {
    setHoveredReservation(r)
    if (e) setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  const toggleCalendarSlot = (start: string, end: string) => {
    setReservationSlots((prev) => {
      const i = prev.findIndex((s) => s.start === start && s.end === end)
      if (i >= 0) return prev.filter((_, j) => j !== i)
      return [...prev, { start, end }].sort((a, b) => a.start.localeCompare(b.start))
    })
  }
  const removeReservationSlot = (index: number) => {
    setReservationSlots((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    const load = async () => {
      setLoadError(null)
      const [roomsRes, resRes, meRes, mainRes] = await Promise.all([
        fetch('/api/rooms', { credentials: 'include' }),
        fetch('/api/room-reservations', { credentials: 'include' }),
        fetch('/api/me', { credentials: 'include' }),
        fetch('/api/users/main-users', { credentials: 'include' }),
      ])
      if (roomsRes.ok) setRooms(await roomsRes.json())
      if (resRes.ok) {
        setReservations(await resRes.json())
      } else {
        const err = await resRes.json().catch(() => ({}))
        setLoadError(err?.error || 'Reservierungen konnten nicht geladen werden.')
      }
      if (meRes.ok) {
        const me = await meRes.json()
        setIsAdmin(!!me.isAdmin)
        if (me.projects?.length) setProjects(me.projects)
      }
      if (mainRes.ok) {
        const list = await mainRes.json()
        setMainUsers(Array.isArray(list) ? list : [])
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const pid = projectIdParam || reservationProjectId
    if (!pid) {
      setEvents([])
      return
    }
    fetch(`/api/events?projectId=${pid}&list=true`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setEvents(Array.isArray(list) ? list : []))
  }, [projectIdParam, reservationProjectId])

  useEffect(() => {
    if (projectIdParam && projects.length) {
      const p = projects.find((x: { id: string }) => x.id === projectIdParam)
      if (p) setReservationTitle(p.name)
    }
  }, [projectIdParam, projects])

  useEffect(() => {
    if (eventIdParam && events.length) {
      const e = events.find((x: { id: string }) => x.id === eventIdParam)
      if (e) setReservationTitle(e.title)
    }
  }, [eventIdParam, events])

  useEffect(() => {
    setReservationSlots([])
  }, [reservationRoomId])

  useEffect(() => {
    if (!reservationRoomId) {
      setRoomReservationsForCalendar([])
      return
    }
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - 30)
    const to = new Date()
    to.setHours(0, 0, 0, 0)
    to.setDate(to.getDate() + 60)
    fetch(`/api/room-reservations?roomId=${reservationRoomId}&from=${from.toISOString()}&to=${to.toISOString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setRoomReservationsForCalendar(Array.isArray(list) ? list : []))
  }, [reservationRoomId])

  useEffect(() => {
    if (projectIdParam) {
      setReservationProjectId(projectIdParam)
      setReservationEventId(eventIdParam || '')
      setShowReservationForm(true)
    }
  }, [projectIdParam, eventIdParam])

  const addRoom = async () => {
    if (!newRoomName.trim()) return
    setAddingRoom(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRoomName.trim(), description: newRoomDesc.trim() || undefined }),
      })
      if (res.ok) {
        const room = await res.json()
        setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)))
        setNewRoomName('')
        setNewRoomDesc('')
      } else {
        const err = await res.json()
        alert(err.error || 'Fehler')
      }
    } finally {
      setAddingRoom(false)
    }
  }

  const updateRoom = async (id: string) => {
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editRoomName.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRooms((prev) => prev.map((r) => (r.id === id ? updated : r)))
        setEditingRoomId(null)
      }
    } catch {
      setEditingRoomId(null)
    }
  }

  const deleteRoom = async (id: string) => {
    if (!confirm('Raum wirklich löschen? Alle Reservierungen für diesen Raum gehen verloren.')) return
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== id))
        setReservations((prev) => prev.filter((r) => r.roomId !== id))
      } else {
        const err = await res.json()
        alert(err.error || 'Fehler')
      }
    } catch {
      alert('Fehler')
    }
  }

  const submitReservation = async () => {
    const slotsToSave =
      reservationSlots.length > 0
        ? reservationSlots
        : reservationStart
          ? [{ start: reservationStart, end: reservationEnd || reservationStart }]
          : []
    if (!reservationRoomId || !reservationTitle.trim() || slotsToSave.length === 0) {
      alert('Bitte Raum, Titel und mindestens einen Zeitblock angeben (Kalender oder Start/Ende).')
      return
    }
    setSavingReservation(true)
    try {
      const created: Reservation[] = []
      for (const slot of slotsToSave) {
        const res = await fetch('/api/room-reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            roomId: reservationRoomId,
            projectId: reservationProjectId || undefined,
            eventId: reservationEventId || undefined,
            responsibleUserId: reservationResponsibleUserId || undefined,
            eventLeaderId: reservationEventLeaderId || undefined,
            title: reservationTitle.trim(),
            startAt: slot.start,
            endAt: slot.end || undefined,
            notes: reservationNotes.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || 'Fehler beim Speichern')
          return
        }
        created.push(await res.json())
      }
      setReservations((prev) => [...created, ...prev].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()))
      setShowReservationForm(false)
      setReservationRoomId('')
      setReservationTitle('')
      setReservationStart('')
      setReservationEnd('')
      setReservationSlots([])
      setReservationNotes('')
      setReservationProjectId('')
      setReservationEventId('')
      setReservationResponsibleUserId('')
      setReservationEventLeaderId('')
    } finally {
      setSavingReservation(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Laden…</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Raum-Reservierungen</h1>
      <p className="mb-6 text-sm text-gray-600">
        Reservierungen können manuell angelegt werden oder aus dem Projektbereich („Raum reservieren“). Admin und Hauptbenutzer können Reservierungen erstellen; nur der Admin verwaltet die Räume.
      </p>

      {loadError && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {loadError} Bitte ggf. Datenbank-Migration ausführen (npx prisma migrate deploy).
        </div>
      )}

      {isAdmin && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="mb-3 font-medium">Räume verwalten (nur Admin)</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Raumname"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newRoomDesc}
              onChange={(e) => setNewRoomDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addRoom}
              disabled={addingRoom || !newRoomName.trim()}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {addingRoom ? 'Hinzufügen…' : 'Raum hinzufügen'}
            </button>
          </div>
          <ul className="mt-3 space-y-1">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                {editingRoomId === r.id ? (
                  <>
                    <input
                      type="text"
                      value={editRoomName}
                      onChange={(e) => setEditRoomName(e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1"
                    />
                    <button type="button" onClick={() => updateRoom(r.id)} className="text-sky-600">Speichern</button>
                    <button type="button" onClick={() => setEditingRoomId(null)} className="text-gray-500">Abbrechen</button>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{r.name}</span>
                    {r.description && <span className="text-gray-500">— {r.description}</span>}
                    <button type="button" onClick={() => { setEditingRoomId(r.id); setEditRoomName(r.name); }} className="text-sky-600">Bearbeiten</button>
                    <button type="button" onClick={() => deleteRoom(r.id)} className="text-red-600">Löschen</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-2 font-medium">Neue Reservierung</h2>
        {!showReservationForm ? (
          <button
            type="button"
            onClick={() => setShowReservationForm(true)}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Reservierung anlegen
          </button>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600">Raum *</label>
                <select
                  value={reservationRoomId}
                  onChange={(e) => setReservationRoomId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— wählen —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Titel *</label>
                <input
                  type="text"
                  value={reservationTitle}
                  onChange={(e) => setReservationTitle(e.target.value)}
                  placeholder="z. B. Projektname oder Anlass"
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              {projects.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Projekt (optional)</label>
                    <select
                      value={reservationProjectId}
                      onChange={(e) => { setReservationProjectId(e.target.value); setReservationEventId(''); }}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— manuell —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Event (optional)</label>
                    <select
                      value={reservationEventId}
                      onChange={(e) => setReservationEventId(e.target.value)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— keins —</option>
                      {events
                        .filter((ev) => !reservationProjectId || ev.projectId === reservationProjectId)
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.title} ({formatDate(ev.date)})</option>
                        ))}
                    </select>
                  </div>
                </>
              )}
              {mainUsers.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Verantwortlicher Hauptnutzer</label>
                    <select
                      value={reservationResponsibleUserId}
                      onChange={(e) => setReservationResponsibleUserId(e.target.value)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— wählen —</option>
                      {mainUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Leiter der Veranstaltung</label>
                    <select
                      value={reservationEventLeaderId}
                      onChange={(e) => setReservationEventLeaderId(e.target.value)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— wählen —</option>
                      {mainUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Start *</label>
                    <div className="mt-0.5 flex gap-2">
                      <input
                        type="datetime-local"
                        value={reservationStart}
                        onChange={(e) => setReservationStart(e.target.value)}
                        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStartCalendar((v) => !v)}
                        className="rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm hover:bg-gray-100"
                      >
                        {showStartCalendar ? 'Kalender schließen' : 'Kalender öffnen'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Ende (optional)</label>
                    <input
                      type="datetime-local"
                      value={reservationEnd}
                      onChange={(e) => setReservationEnd(e.target.value)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                {showStartCalendar && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {!reservationRoomId ? (
                      <p className="text-sm text-gray-500">Bitte zuerst einen Raum wählen, dann werden bestehende Buchungen angezeigt.</p>
                    ) : (
                      <>
                        <RoomCalendar
                          roomReservations={roomReservationsForCalendar}
                          selectedSlots={reservationSlots}
                          onToggleSlot={toggleCalendarSlot}
                        />
                        {reservationSlots.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-gray-600">
                              Gewählte Blöcke ({reservationSlots.length}):
                            </p>
                            <ul className="space-y-1 text-xs">
                              {reservationSlots.map((slot, i) => (
                                <li key={i} className="flex items-center justify-between rounded bg-white px-2 py-1">
                                  <span>
                                    {formatDateTime(slot.start)} – {formatDateTime(slot.end)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeReservationSlot(i)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Entfernen
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600">Notizen</label>
                <input
                  type="text"
                  value={reservationNotes}
                  onChange={(e) => setReservationNotes(e.target.value)}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={submitReservation}
                disabled={savingReservation}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {savingReservation
                  ? 'Speichern…'
                  : reservationSlots.length > 1
                    ? `${reservationSlots.length} Reservierungen speichern`
                    : reservationSlots.length === 1 || reservationStart
                      ? 'Reservierung speichern'
                      : 'Reservierung speichern'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReservationForm(false)
                  setReservationProjectId('')
                  setReservationEventId('')
                  setReservationResponsibleUserId('')
                  setReservationEventLeaderId('')
                  setShowStartCalendar(false)
                  setReservationSlots([])
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Aktuelle Reservierungen</h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Reservierungen.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-gray-500">Kalender (farbig nach Raum). Fahren Sie mit der Maus über einen Block oder eine Zeile für Details.</p>
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-2">
              <ReservationsCalendarView
                reservations={reservations}
                onHoverReservation={handleHoverReservation}
              />
            </div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Liste</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Raum</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Titel</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Start</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Ende</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Projekt / Event</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Verantwortlicher</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Leiter</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Reserviert von</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reservations.map((r) => (
                    <tr
                      key={r.id}
                      className="bg-white hover:bg-gray-50"
                      style={{ borderLeftWidth: 4, borderLeftColor: getRoomColor(r.roomId) }}
                      onMouseEnter={(e) => handleHoverReservation(r, e)}
                      onMouseMove={(e) => { if (hoveredReservation?.id === r.id) setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseLeave={(e) => handleHoverReservation(null, e)}
                    >
                      <td className="px-3 py-2">{r.room.name}</td>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2">{formatDateTime(r.startAt)}</td>
                      <td className="px-3 py-2">{r.endAt ? formatDateTime(r.endAt) : '–'}</td>
                      <td className="px-3 py-2">
                        {r.project ? r.project.name : '–'}
                        {r.event && <span className="text-gray-500"> / {r.event.title}</span>}
                      </td>
                      <td className="px-3 py-2">{r.responsibleUser ? (r.responsibleUser.name || r.responsibleUser.email) : '–'}</td>
                      <td className="px-3 py-2">{r.eventLeader ? (r.eventLeader.name || r.eventLeader.email) : '–'}</td>
                      <td className="px-3 py-2">{r.reservedBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {hoveredReservation && (
        <ReservationTooltip
          reservation={hoveredReservation}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}

      <Link href="/dashboard" className="mt-6 inline-block text-indigo-600 hover:underline">← Zum Dashboard</Link>
    </div>
  )
}
