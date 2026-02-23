'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface EingangGuestRow {
  id: string
  name: string
  vorname: string
  nachname: string
  tischNummer: string
  kategorie: string
  isVip: boolean
  staatInstitution: string
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

function isVipFromAdditional(add: Record<string, any>, guestIsVip: boolean): boolean {
  if (guestIsVip) return true
  const v = add['VIP'] ?? add['vip']
  return v === true || v === 'true'
}

export default function PublicCheckinPage() {
  const params = useParams()
  const token = params?.token as string
  const [rows, setRows] = useState<EingangGuestRow[]>([])
  const [filteredRows, setFilteredRows] = useState<EingangGuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [togglingAnwesendId, setTogglingAnwesendId] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadAcceptedGuests()
    }
  }, [token])

  const loadAcceptedGuests = async () => {
    if (!token) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/checkin-public/${token}/guests`)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError('Ungültiger Zugangscode')
        } else {
          setError('Fehler beim Laden der Gäste')
        }
        setRows([])
        setFilteredRows([])
        return
      }

      const guests = await response.json()
      
      const mapped: EingangGuestRow[] = guests.map((g: any) => {
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

        let staatInstitution = ''
        if (g.organization && String(g.organization).trim() !== '') {
          staatInstitution = String(g.organization).trim()
        } else {
          staatInstitution = getFromAdditional(add, [
            'Staat/Institution',
            'Staat / Institution',
            'StaatInstitution',
            'Staat_Institution',
            'Institution',
            'Staat',
          ]) || (() => {
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
          anwesend,
        }
      })

      setRows(mapped)
      setFilteredRows(mapped)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
      setError('Fehler beim Laden der Daten')
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

  const handleAnwesendChange = async (row: EingangGuestRow) => {
    const newValue = !row.anwesend
    setTogglingAnwesendId(row.id)
    try {
      const response = await fetch(`/api/checkin-public/${token}/anwesend`, {
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
    } catch (error) {
      console.error('Fehler beim Setzen Anwesend:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Speichern')
    } finally {
      setTogglingAnwesendId(null)
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Zugriff verweigert</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Gästeliste Check-in</h1>
          <p className="mt-1 text-sm text-indigo-100">Externer Zugang – Suchfeld und Gast angekommen</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 rounded-xl bg-white p-4 shadow-md sm:p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold sm:text-xl">Gästeliste</h2>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Suche nach Name, Tisch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          </div>

          {loading ? (
            <p className="py-8 text-center text-gray-500">Lädt...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">
                {searchQuery ? 'Keine Gäste gefunden' : 'Keine Gäste vorhanden'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4">
                      Tisch
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4">
                      Staat/Inst.
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4">
                      VIP
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4">
                      Gast angekommen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-gray-900 sm:px-4">
                        {row.tischNummer || '-'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-900 sm:px-4">
                        <div className="font-medium">{row.name}</div>
                        {row.kategorie && (
                          <div className="text-xs text-gray-500">{row.kategorie}</div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-900 sm:px-4">
                        {row.staatInstitution || '-'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-center text-sm sm:px-4">
                        {row.isVip ? (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                            VIP
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-center sm:px-4">
                        <label className="flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={row.anwesend}
                            disabled={togglingAnwesendId === row.id}
                            onChange={() => handleAnwesendChange(row)}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {togglingAnwesendId === row.id && (
                            <span className="ml-2 text-xs text-gray-400">…</span>
                          )}
                        </label>
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
