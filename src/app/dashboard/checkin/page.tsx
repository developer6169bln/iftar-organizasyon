'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

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
  /** Begleitperson (bei Zusage erfasst); dann Anwesend über /api/accompanying-guests/anwesend */
  isAccompanying?: boolean
  accompanyingGuestId?: string
  mainGuestName?: string
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
  const [exportPdfLoading, setExportPdfLoading] = useState(false)

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
      const [guestsRes, accompanyingRes] = await Promise.all([
        fetch(`/api/guests?eventId=${eventId}`),
        fetch(`/api/accompanying-guests?eventId=${eventId}`),
      ])

      if (!guestsRes.ok) {
        console.error('Fehler beim Laden der Gäste')
        setRows([])
        setFilteredRows([])
        return
      }

      const guests = await guestsRes.json()
      const guestsWithZusage = guests.filter((g: any) => {
        const add = parseAdditionalData(g.additionalData)
        return add['Zusage'] === true || add['Zusage'] === 'true'
      })

      const mapped: EingangGuestRow[] = guestsWithZusage.map((g: any) => {
        const add = parseAdditionalData(g.additionalData)
        const fullName: string = g.name || ''
        // Vorname/Nachname aus additionalData (z. B. Import/Sheets), sonst aus vollem Namen splitten
        let vorname = getFromAdditional(add, ['Vorname', 'vorname', 'Vorname ', 'FirstName'])
        let nachname = getFromAdditional(add, ['Nachname', 'nachname', 'Name', 'LastName', 'Familienname'])
        if (!vorname && !nachname) {
          const nameParts = fullName.split(' ').filter((p: string) => p.trim() !== '')
          vorname = nameParts[0] || ''
          nachname = nameParts.slice(1).join(' ') || ''
        }
        const tischNummer =
          g.tableNumber != null
            ? String(g.tableNumber)
            : getFromAdditional(add, ['Tisch-Nummer', 'Tischnummer', 'Tisch'])
        const kategorie = getFromAdditional(add, ['Kategorie', 'Kategorie ', 'KATEGORIE'])
        // Staat/Institution: zuerst guest.organization, dann additionalData mit vielen Schreibweisen
        let staatInstitution = ''
        if (g.organization != null && String(g.organization).trim() !== '') {
          staatInstitution = String(g.organization).trim()
        }
        if (!staatInstitution) {
          staatInstitution = getFromAdditional(add, [
            'Staat/Institution',
            'Staat / Institution',
            'Staat/ Institution',
            'Staat /Institution',
            'StaatInstitution',
            'Staat_Institution',
            'Institution',
            'Staat',
            'Organisation',
            'Organization',
          ])
        }
        if (!staatInstitution) {
          for (const [key, value] of Object.entries(add)) {
            const k = key.toLowerCase()
            if (
              (k.includes('staat') || k.includes('institution') || k.includes('organisation') || k.includes('organization')) &&
              value != null &&
              String(value).trim() !== ''
            ) {
              staatInstitution = String(value).trim()
              break
            }
          }
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

      if (accompanyingRes.ok) {
        const accompanyingList = await accompanyingRes.json()
        for (const a of accompanyingList) {
          const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Begleitperson'
          const nameParts = name.split(' ').filter((p: string) => p.trim() !== '')
          mapped.push({
            id: `accompanying-${a.id}`,
            name,
            vorname: nameParts[0] || a.firstName || '',
            nachname: nameParts.slice(1).join(' ') || a.lastName || '',
            tischNummer: '-',
            kategorie: 'Begleitperson',
            isVip: false,
            staatInstitution: a.mainGuestName || '',
            anrede1: a.funktion || '',
            anrede2: '',
            anrede3: '',
            notizen: '',
            anwesend: !!a.arrivedAt,
            isAccompanying: true,
            accompanyingGuestId: a.id,
            mainGuestName: a.mainGuestName || '',
          })
        }
      }

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
      if (row.isAccompanying && row.accompanyingGuestId) {
        const response = await fetch('/api/accompanying-guests/anwesend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accompanyingGuestId: row.accompanyingGuestId, anwesend: newValue }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Fehler beim Speichern')
        }
      } else {
        const response = await fetch('/api/checkin/anwesend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: row.id, anwesend: newValue }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Fehler beim Speichern')
        }
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, anwesend: newValue } : r))
      )
      setFilteredRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, anwesend: newValue } : r))
      )
    } catch (error) {
      console.error('Fehler beim Setzen Anwesend:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Speichern')
    } finally {
      setTogglingAnwesendId(null)
    }
  }

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('Keine Daten zum Exportieren.')
      return
    }
    const exportData = filteredRows.map((row) => ({
      'Tisch-Nummer': row.tischNummer || '',
      GAST: row.name || '',
      'STAAT/INSTITUTION': row.staatInstitution || '',
      Kategorie: row.kategorie || '',
      VIP: row.isVip ? 'Ja' : 'Nein',
      Vorname: row.vorname || '',
      Name: row.nachname || '',
      'Anrede 1': row.anrede1 || '',
      'Anrede 2': row.anrede2 || '',
      'Anrede 3': row.anrede3 || '',
      Anwesend: row.anwesend ? 'Ja' : 'Nein',
      Notizen: row.notizen || '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)
    XLSX.utils.book_append_sheet(wb, ws, 'Zusagen')
    const fileName = `Zusagen_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const handleExportPdf = async () => {
    if (filteredRows.length === 0) {
      alert('Keine Daten zum Exportieren.')
      return
    }
    setExportPdfLoading(true)
    try {
      const res = await fetch('/api/checkin/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: filteredRows.map((r) => ({
            id: r.id,
            name: r.name,
            vorname: r.vorname,
            nachname: r.nachname,
            tischNummer: r.tischNummer,
            kategorie: r.kategorie,
            isVip: r.isVip,
            staatInstitution: r.staatInstitution,
            anrede1: r.anrede1,
            anrede2: r.anrede2,
            anrede3: r.anrede3,
            notizen: r.notizen,
            anwesend: r.anwesend,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'PDF-Export fehlgeschlagen')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Zusagen_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'PDF-Export fehlgeschlagen')
    } finally {
      setExportPdfLoading(false)
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
        {/* Externer Link: Gästeliste beim Check-in */}
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="text-lg font-semibold text-indigo-900">Externer Link für die Gästeliste (Check-in)</h3>
          <p className="mt-1 text-sm text-indigo-700">
            Mit diesem Link können Sie am Eingang die Gästeliste prüfen – ohne Login. Enthält Suchfeld und Checkbox „Gast angekommen“.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={publicLink}
              readOnly
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicLink)
                alert('Link kopiert!')
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Kopieren
            </button>
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
            >
              Link öffnen
            </a>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">
            <strong>QR-Check-in am Einlass:</strong> Jeder Gast erhält nach der Zusage einen persönlichen QR-Code.
            Beim Scannen des Codes wird die Person automatisch als anwesend eingetragen.
          </p>
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Liste der Gäste mit Zusage</h2>
            <div className="flex flex-wrap items-center gap-3">
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
              <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredRows.length === 0}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={filteredRows.length === 0 || exportPdfLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportPdfLoading ? '… Exportiere' : 'Export PDF'}
                </button>
              </div>
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
                      GAST
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      STAAT/INSTITUTION
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Kategorie
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                      VIP
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
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {row.name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {row.staatInstitution || '-'}
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
