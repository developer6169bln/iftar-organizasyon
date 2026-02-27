'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

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
    if (tableNumber >= t.start && tableNumber < t.start + t.slots) return t.label
  }
  return null
}

function getPlatz(tableNumber: number): number {
  for (const t of SONDERTISCHE) {
    if (tableNumber >= t.start && tableNumber < t.start + t.slots) return tableNumber - t.start + 1
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

export default function PublicCheckinVipPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params?.token as string
  const eventId = searchParams?.get('eventId') || undefined
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const url = eventId
      ? `/api/checkin-public/${token}/guests?eventId=${encodeURIComponent(eventId)}`
      : `/api/checkin-public/${token}/guests`
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) setError('Ungültiger Zugangscode')
          else setError('Fehler beim Laden der Gäste')
          return []
        }
        return res.json()
      })
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
      .catch(() => { if (!cancelled) setError('Fehler beim Laden') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, eventId])

  const filteredGuests = !searchQuery.trim()
    ? guests
    : guests.filter((g) => {
        const q = searchQuery.trim().toLowerCase()
        return g.name.toLowerCase().includes(q) || g.tableLabel.toLowerCase().includes(q)
      })

  const byTable = new Map<string, GuestRow[]>()
  for (const g of filteredGuests) {
    if (!byTable.has(g.tableLabel)) byTable.set(g.tableLabel, [])
    byTable.get(g.tableLabel)!.push(g)
  }
  for (const t of SONDERTISCHE) {
    if (!byTable.has(t.label)) byTable.set(t.label, [])
  }

  const handleAnwesend = async (row: GuestRow) => {
    const newValue = !row.anwesend
    setTogglingId(row.id)
    try {
      const res = await fetch(`/api/checkin-public/${token}/anwesend`, {
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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Zugriff verweigert</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-600 py-4 text-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold">Check-in VIP & Sondertische</h1>
          <p className="mt-1 text-sm text-amber-100">
            VIP, STB BASKAN, SPONSOR-STK 1–4 – Anwesend per Checkbox
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Suchen nach Name oder Tisch…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="ml-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Zurücksetzen
            </button>
          )}
        </div>

        {loading ? (
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
