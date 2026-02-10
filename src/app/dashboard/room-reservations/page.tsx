'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Room = { id: string; name: string; description?: string | null; _count?: { reservations: number } }
type Reservation = {
  id: string
  roomId: string
  room: { id: string; name: string }
  project?: { id: string; name: string } | null
  event?: { id: string; title: string; date: string } | null
  reservedBy: { id: string; name: string; email: string }
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
  const [savingReservation, setSavingReservation] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [roomsRes, resRes, meRes] = await Promise.all([
        fetch('/api/rooms', { credentials: 'include' }),
        fetch('/api/room-reservations', { credentials: 'include' }),
        fetch('/api/me', { credentials: 'include' }),
      ])
      if (roomsRes.ok) setRooms(await roomsRes.json())
      if (resRes.ok) setReservations(await resRes.json())
      if (meRes.ok) {
        const me = await meRes.json()
        setIsAdmin(!!me.isAdmin)
        if (me.projects?.length) setProjects(me.projects)
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
                <label className="block text-xs font-medium text-gray-600">Start *</label>
                <input
                  type="datetime-local"
                  value={reservationStart}
                  onChange={(e) => setReservationStart(e.target.value)}
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
                onClick={() => { setShowReservationForm(false); setReservationProjectId(''); setReservationEventId(''); }}
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
