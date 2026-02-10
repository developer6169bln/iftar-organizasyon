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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function RoomCalendar({
  roomReservations,
  onSelectSlot,
}: {
  roomReservations: Reservation[]
  onSelectSlot: (startIso: string, endIso: string) => void
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

  return (
    <div>
      <p className="mb-2 text-xs text-gray-600">Gebuchte Zeiten sind markiert und nicht wählbar. Klicken Sie auf eine freie Stunde.</p>
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
                  return (
                    <td key={day.toISOString() + hour} className="border border-gray-300 p-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (busy) return
                          const toLocal = (d: Date) =>
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                          onSelectSlot(toLocal(slotStart), toLocal(slotEnd))
                        }}
                        className={`block w-full py-2 text-center ${busy ? 'cursor-not-allowed bg-red-100 text-gray-500' : 'bg-white hover:bg-sky-50'}`}
                        title={busy ? 'Belegt' : `${slotStart.toLocaleString('de-DE')} wählen`}
                      >
                        {busy ? '–' : '✓'}
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
  const [savingReservation, setSavingReservation] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    if (!reservationRoomId || !reservationTitle.trim() || !reservationStart) {
      alert('Bitte Raum, Titel und Startzeit angeben.')
      return
    }
    setSavingReservation(true)
    try {
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
          startAt: reservationStart,
          endAt: reservationEnd || undefined,
          notes: reservationNotes.trim() || undefined,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setReservations((prev) => [created, ...prev].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()))
        setShowReservationForm(false)
        setReservationRoomId('')
        setReservationTitle('')
        setReservationStart('')
        setReservationEnd('')
        setReservationNotes('')
        setReservationProjectId('')
        setReservationEventId('')
        setReservationResponsibleUserId('')
        setReservationEventLeaderId('')
      } else {
        const err = await res.json()
        alert(err.error || 'Fehler')
      }
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
              <div>
                <label className="block text-xs font-medium text-gray-600">Ende (optional)</label>
                <input
                  type="datetime-local"
                  value={reservationEnd}
                  onChange={(e) => setReservationEnd(e.target.value)}
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
                {showStartCalendar && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {!reservationRoomId ? (
                      <p className="text-sm text-gray-500">Bitte zuerst einen Raum wählen, dann werden bestehende Buchungen angezeigt.</p>
                    ) : (
                      <RoomCalendar
                        roomReservations={roomReservationsForCalendar}
                        onSelectSlot={(start, end) => {
                          setReservationStart(start)
                          if (!reservationEnd) setReservationEnd(end)
                          setShowStartCalendar(false)
                        }}
                      />
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
                {savingReservation ? 'Speichern…' : 'Reservierung speichern'}
              </button>
              <button
                type="button"
                onClick={() => { setShowReservationForm(false); setReservationProjectId(''); setReservationEventId(''); setReservationResponsibleUserId(''); setReservationEventLeaderId(''); setShowStartCalendar(false); }}
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
                  <tr key={r.id} className="bg-white">
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
        )}
      </div>

      <Link href="/dashboard" className="mt-6 inline-block text-indigo-600 hover:underline">← Zum Dashboard</Link>
    </div>
  )
}
