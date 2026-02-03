'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface EingangGuestRow {
  id: string
  name: string
  vorname: string
  nachname: string
  tischNummer: string
  kategorie: string
  isVip: boolean
  staatInstitution: string
  anrede1: string
  anrede2: string
  anrede3: string
  notizen: string
  anwesend: boolean
}

function parseAdditionalData(additionalData: any): Record<string, any> {
  if (!additionalData) return {}
  try {
    if (typeof additionalData === 'string') {
      return JSON.parse(additionalData)
    }
    if (typeof additionalData === 'object') {
      return additionalData as Record<string, any>
    }
  } catch {
    // ignorieren
  }
  return {}
}

function getFromAdditional(add: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(add, key) && add[key] != null) {
      const v = String(add[key]).trim()
      if (v !== '') return v
    }
  }
  return ''
}

/** VIP aus additionalData (wie in Gästeliste): VIP, vip, true / 'true' */
function isVipFromAdditional(add: Record<string, any>, guestIsVip: boolean): boolean {
  if (guestIsVip) return true
  const v = add['VIP'] ?? add['vip']
  return v === true || v === 'true'
}

export default function EingangskontrollePage() {
  const [rows, setRows] = useState<EingangGuestRow[]>([])
  const [filteredRows, setFilteredRows] = useState<EingangGuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [eventId, setEventId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string>('')
  const [togglingAnwesendId, setTogglingAnwesendId] = useState<string | null>(null)
  const [publicLink, setPublicLink] = useState<string>('')
  const [showPublicLink, setShowPublicLink] = useState(false)

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const response = await fetch(eventsUrl)
        if (response.ok) {
          const events = await response.json()
          const event = Array.isArray(events) ? (events.length > 0 ? events[0] : null) : events
          if (event?.id) setEventId(event.id)
        }
      } catch (error) {
        console.error('Fehler beim Laden des Events:', error)
      }
    }
    loadEvent()
  }, [])

  useEffect(() => {
    const onProjectChange = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const res = await fetch(eventsUrl)
        if (res.ok) {
          const data = await res.json()
          const event = Array.isArray(data) ? (data[0] ?? null) : data
          if (event?.id) setEventId(event.id)
        }
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  useEffect(() => {
    if (eventId) {
      loadAcceptedGuests()
    }
    // Lade öffentlichen Link von API
    fetch('/api/checkin-public/link')
      .then((res) => res.json())
      .then((data) => setPublicLink(data.link))
      .catch(() => {
        // Fallback falls API nicht verfügbar
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        setPublicLink(`${baseUrl}/checkin-public/checkin2024`)
      })
  }, [eventId])

  const loadAcceptedGuests = async () => {
    if (!eventId) return

    try {
      setLoading(true)
      // Lade alle Gäste für das Event
      const response = await fetch(`/api/guests?eventId=${eventId}`)
      if (!response.ok) {
        console.error('Fehler beim Laden der Gäste')
        setRows([])
        setFilteredRows([])
        return
      }

      const guests = await response.json()
      
      // Filtere nach Gästen mit Zusage = true in additionalData
      const guestsWithZusage = guests.filter((g: any) => {
        const add = parseAdditionalData(g.additionalData)
        return add['Zusage'] === true || add['Zusage'] === 'true'
      })
      
      console.log(`📥 Eingangskontrolle: ${guestsWithZusage.length} Gäste mit Zusage geladen`)

      const mapped: EingangGuestRow[] = guestsWithZusage.map((g: any) => {
        const add = parseAdditionalData(g.additionalData)

        const fullName: string = g.name || ''
        const nameParts = fullName.split(' ').filter((p: string) => p.trim() !== '')
        const vorname = nameParts[0] || ''
        const nachname = nameParts.slice(1).join(' ') || fullName

        const tischNummer =
          g.tableNumber != null
            ? String(g.tableNumber)
            : getFromAdditional(add, ['Tisch-Nummer', 'Tischnummer', 'Tisch'])

        const kategorie = getFromAdditional(add, ['Kategorie', 'Kategorie ', 'KATEGORIE'])

        // Staat/Institution: zuerst organization, dann additionalData
        let staatInstitution = ''
        if (g.organization && String(g.organization).trim() !== '') {
          staatInstitution = String(g.organization).trim()
        } else {
          staatInstitution =
            getFromAdditional(add, [
              'Staat/Institution',
              'Staat / Institution',
              'StaatInstitution',
              'Staat_Institution',
              'Institution',
              'Staat',
            ]) ||
            // Fallback: irgendein Key mit Staat/Institution im Namen
            (() => {
              for (const [key, value] of Object.entries(add)) {
                const k = key.toLowerCase()
                if (
                  (k.includes('staat') || k.includes('institution')) &&
                  value != null &&
                  String(value).trim() !== ''
                ) {
                  return String(value).trim()
                }
              }
              return ''
            })()
        }

        const anrede1 = getFromAdditional(add, ['Anrede 1', 'Anrede1', 'Anrede_1'])
        const anrede2 = getFromAdditional(add, ['Anrede 2', 'Anrede2', 'Anrede_2'])
        const anrede3 = getFromAdditional(add, ['Anrede 3', 'Anrede3', 'Anrede_3'])
        const anwesend = add['Anwesend'] === true || add['Anwesend'] === 'true'
        const isVip = isVipFromAdditional(add, !!g.isVip)

        return {
          id: g.id,
          name: fullName,
          vorname,
          nachname,
          tischNummer: tischNummer || '',
          kategorie: kategorie || '',
          isVip,
          staatInstitution: staatInstitution || '',
          anrede1,
          anrede2,
          anrede3,
          notizen: g.notes || '',
          anwesend,
        }
      })

      setRows(mapped)
      setFilteredRows(mapped)
    } catch (error) {
      console.error('Fehler beim Laden der Eingangskontrolle-Gäste:', error)
      setRows([])
      setFilteredRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRows(rows)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredRows(
      rows.filter((row) => {
        return (
          row.name.toLowerCase().includes(q) ||
          row.vorname.toLowerCase().includes(q) ||
          row.nachname.toLowerCase().includes(q) ||
          row.staatInstitution.toLowerCase().includes(q) ||
          row.tischNummer.toLowerCase().includes(q) ||
          row.kategorie.toLowerCase().includes(q)
        )
      })
    )
  }, [searchQuery, rows])

  const handleEditNotes = (row: EingangGuestRow) => {
    setEditingId(row.id)
    setEditingNotes(row.notizen || '')
  }

  const handleSaveNotes = async (guestId: string) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          notes: editingNotes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Fehler beim Speichern der Notizen')
        return
      }

      const updated = await response.json()

      setRows((prev) =>
        prev.map((r) => (r.id === guestId ? { ...r, notizen: updated.notes || '' } : r))
      )
      setFilteredRows((prev) =>
        prev.map((r) => (r.id === guestId ? { ...r, notizen: updated.notes || '' } : r))
      )
      setEditingId(null)
      setEditingNotes('')
    } catch (error) {
      console.error('Fehler beim Speichern der Notizen:', error)
      alert('Fehler beim Speichern der Notizen')
    }
  }

  const handleAnwesendChange = async (row: EingangGuestRow) => {
    const newValue = !row.anwesend
    setTogglingAnwesendId(row.id)
    try {
      const response = await fetch('/api/checkin/anwesend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: row.id, anwesend: newValue }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Fehler beim Speichern')
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, anwesend: newValue } : r))
      )
      setFilteredRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, anwesend: newValue } : r))
      )
      if (newValue) {
        // Push wurde serverseitig an alle User gesendet
      }
    } catch (error) {
      console.error('Fehler beim Setzen Anwesend:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Speichern')
    } finally {
      setTogglingAnwesendId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Eingangskontrolle</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Öffentlicher Link Bereich */}
        <div className="mb-6 rounded-xl bg-indigo-50 border border-indigo-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-indigo-900">Öffentlicher Zugang</h3>
              <p className="mt-1 text-sm text-indigo-700">
                Link für Mobilgeräte ohne Login
              </p>
            </div>
            <button
              onClick={() => setShowPublicLink(!showPublicLink)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {showPublicLink ? 'Verbergen' : 'Link anzeigen'}
            </button>
          </div>
          {showPublicLink && (
            <div className="mt-4 rounded-lg bg-white p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Öffentlicher Link (kopieren und teilen):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={publicLink}
                  readOnly
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(publicLink)
                    alert('Link kopiert!')
                  }}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Kopieren
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Dieser Link kann ohne Login verwendet werden. Perfekt für Mobilgeräte.
              </p>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Liste der Gäste mit Zusage</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Suche nach Name, Tisch, Staat/Institution..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-72 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500">Lädt...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">
                {searchQuery
                  ? 'Keine Gäste mit Zusage gefunden'
                  : 'Keine Gäste mit Zusage vorhanden'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Gäste erscheinen hier, sobald sie per Einladungs-E-Mail zugesagt haben (ACCEPTED).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Tisch-Nummer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Kategorie
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                      VIP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Staat/Institution
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Vorname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Anrede 1
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Anrede 2
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Anrede 3
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Anwesend
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Notizen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.tischNummer || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.kategorie || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        {row.isVip ? (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                            VIP
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                            -
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.staatInstitution || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.vorname || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.nachname || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.anrede1 || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.anrede2 || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.anrede3 || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <label className="flex cursor-pointer items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.anwesend}
                            disabled={togglingAnwesendId === row.id}
                            onChange={() => handleAnwesendChange(row)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {togglingAnwesendId === row.id && (
                            <span className="text-xs text-gray-400">…</span>
                          )}
                        </label>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {editingId === row.id ? (
                          <div className="flex flex-col gap-1">
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveNotes(row.id)}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                              >
                                Speichern
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingNotes('')
                                }}
                                className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex-1 break-words">
                              {row.notizen && row.notizen.trim() !== '' ? row.notizen : '-'}
                            </span>
                            <button
                              onClick={() => handleEditNotes(row)}
                              className="whitespace-nowrap text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              Notizen
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
