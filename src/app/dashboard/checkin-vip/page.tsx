'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const VIP_TABLE_START = 901
const VIP_SLOTS = 18
const STB_BASKAN_TABLE_START = 813
const SPONSOR_STK1_TABLE_START = 825
const SPONSOR_STK2_TABLE_START = 837
const SPONSOR_STK3_TABLE_START = 849
const SPONSOR_STK4_TABLE_START = 861
const SPONSOR_STK_SLOTS = 12

const SONDERTISCHE: { label: string; start: number; slots: number }[] = [
  { label: 'VIP', start: VIP_TABLE_START, slots: VIP_SLOTS },
  { label: 'STB BASKAN', start: STB_BASKAN_TABLE_START, slots: SPONSOR_STK_SLOTS },
  { label: 'SPONSOR-STK 1', start: SPONSOR_STK1_TABLE_START, slots: SPONSOR_STK_SLOTS },
  { label: 'SPONSOR-STK 2', start: SPONSOR_STK2_TABLE_START, slots: SPONSOR_STK_SLOTS },
  { label: 'SPONSOR-STK 3', start: SPONSOR_STK3_TABLE_START, slots: SPONSOR_STK_SLOTS },
  { label: 'SPONSOR-STK 4', start: SPONSOR_STK4_TABLE_START, slots: SPONSOR_STK_SLOTS },
]

function getTableLabel(tableNumber: number): string | null {
  for (const t of SONDERTISCHE) {
    if (tableNumber >= t.start && tableNumber < t.start + t.slots) {
      return t.label
    }
  }
  return null
}

function getPlatz(tableNumber: number): number {
  for (const t of SONDERTISCHE) {
    if (tableNumber >= t.start && tableNumber < t.start + t.slots) {
      return tableNumber - t.start + 1
    }
  }
  return 0
}

interface GuestRow {
  id: string
  name: string
  tableNumber: number
  tableLabel: string
  platz: number
  anwesend: boolean
}

function parseAnwesend(additionalData: string | null): boolean {
  if (!additionalData) return false
  try {
    const add = typeof additionalData === 'string' ? JSON.parse(additionalData) : additionalData
    return add?.['Anwesend'] === true || add?.['Anwesend'] === 'true'
  } catch {
    return false
  }
}

export default function CheckinVipPage() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const url = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const event = Array.isArray(data) ? (data[0] ?? null) : data
          if (event?.id) setEventId(event.id)
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadEvent()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const onProjectChange = async () => {
        try {
          const projectId = localStorage.getItem('dashboard-project-id')
          const url = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            const event = Array.isArray(data) ? (data[0] ?? null) : data
            if (event?.id) setEventId(event.id)
          }
        } catch {}
      }
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  useEffect(() => {
    if (!eventId) {
      setGuests([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/guests?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: string; name: string | null; tableNumber: number | null; additionalData: string | null }[]) => {
        if (cancelled) return
        const rows: GuestRow[] = []
        for (const g of list) {
          const tn = g.tableNumber
          if (tn == null) continue
          const label = getTableLabel(tn)
          if (!label) continue
          rows.push({
            id: g.id,
            name: (g.name || '').trim() || '–',
            tableNumber: tn,
            tableLabel: label,
            platz: getPlatz(tn),
            anwesend: parseAnwesend(g.additionalData),
          })
        }
        setGuests(rows)
      })
      .catch(() => { if (!cancelled) setGuests([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [eventId])

  const handleAnwesend = async (row: GuestRow) => {
    const newValue = !row.anwesend
    setTogglingId(row.id)
    try {
      const res = await fetch('/api/checkin/anwesend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: row.id, anwesend: newValue }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Fehler beim Speichern')
      }
      setGuests((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, anwesend: newValue } : r))
      )
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setTogglingId(null)
    }
  }

  const byTable = new Map<string, GuestRow[]>()
  for (const g of guests) {
    if (!byTable.has(g.tableLabel)) byTable.set(g.tableLabel, [])
    byTable.get(g.tableLabel)!.push(g)
  }
  for (const t of SONDERTISCHE) {
    if (!byTable.has(t.label)) byTable.set(t.label, [])
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
              <h1 className="text-2xl font-bold text-gray-900">Check-in VIP & Sondertische</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-6 text-sm text-gray-600">
          Nur Tische: VIP, STB BASKAN, SPONSOR-STK 1–4. Anwesend per Checkbox setzen.
        </p>

        {!eventId ? (
          <p className="rounded-lg bg-amber-50 p-4 text-amber-800">Bitte Projekt/Event auswählen.</p>
        ) : loading ? (
          <p className="text-gray-500">Lade Gäste …</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SONDERTISCHE.map(({ label }) => {
              const list = (byTable.get(label) ?? []).sort((a, b) => a.platz - b.platz)
              return (
                <div
                  key={label}
                  className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm"
                >
                  <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                    {label}
                  </h2>
                  <ul className="space-y-2">
                    {list.length === 0 ? (
                      <li className="text-sm text-gray-500">Keine Gäste zugewiesen.</li>
                    ) : (
                      list.map((row) => (
                        <li
                          key={row.id}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                            row.anwesend ? 'bg-emerald-50' : 'bg-gray-50'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={row.name}>
                            Platz {row.platz}: {row.name}
                          </span>
                          <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={row.anwesend}
                              disabled={togglingId === row.id}
                              onChange={() => handleAnwesend(row)}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-medium text-gray-600">Anwesend</span>
                            {togglingId === row.id && <span className="text-xs text-gray-400">…</span>}
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
