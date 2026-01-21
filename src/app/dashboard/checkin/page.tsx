'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckinPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<any[]>([])
  const [filteredGuests, setFilteredGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [eventId, setEventId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch('/api/events')
        if (response.ok) {
          const events = await response.json()
          if (events.length > 0) {
            setEventId(events[0].id)
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden des Events:', error)
      }
    }
    loadEvent()
  }, [])

  useEffect(() => {
    if (eventId) {
      loadGuests()
    }
  }, [eventId])

  const loadGuests = async () => {
    if (!eventId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/guests?eventId=${eventId}`)
      if (response.ok) {
        const allGuests = await response.json()
        // Filtere nur Gäste mit Status CONFIRMED
        const confirmedGuests = allGuests.filter((guest: any) => guest.status === 'CONFIRMED')
        setGuests(confirmedGuests)
        setFilteredGuests(confirmedGuests)
      } else {
        console.error('Fehler beim Laden der Gäste')
      }
    } catch (error) {
      console.error('Fehler:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Filtere nach Suchbegriff
    if (searchQuery.trim() === '') {
      setFilteredGuests(guests)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = guests.filter(guest =>
      guest.name?.toLowerCase().includes(query) ||
      guest.receptionBy?.toLowerCase().includes(query)
    )
    setFilteredGuests(filtered)
  }, [searchQuery, guests])

  const handleAnwesendChange = async (guestId: string, isAnwesend: boolean) => {
    try {
      const newStatus = isAnwesend ? 'ATTENDED' : 'CONFIRMED'
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          status: newStatus,
        }),
      })

      if (response.ok) {
        // Aktualisiere lokalen State
        setGuests(guests.map(g => g.id === guestId ? { ...g, status: newStatus } : g))
        setFilteredGuests(filteredGuests.map(g => g.id === guestId ? { ...g, status: newStatus } : g))
      } else {
        const error = await response.json()
        alert(error.error || 'Fehler beim Aktualisieren')
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error)
      alert('Fehler beim Aktualisieren')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Check-in</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Check-in Liste</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name oder VIP Begleiter suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          ) : filteredGuests.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">
                {searchQuery ? 'Keine Ergebnisse gefunden' : 'Keine bestätigten Gäste vorhanden'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">VIP Begleiter (Name)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Anwesend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuests.map((guest) => (
                    <tr
                      key={guest.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        guest.status === 'ATTENDED' ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{guest.name || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {guest.receptionBy || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={guest.status === 'ATTENDED' ? 'Ja' : 'Nein'}
                          onChange={(e) => {
                            const isAnwesend = e.target.value === 'Ja'
                            handleAnwesendChange(guest.id, isAnwesend)
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium border-0 focus:ring-2 focus:ring-indigo-500 ${
                            guest.status === 'ATTENDED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <option value="Nein">Nein</option>
                          <option value="Ja">Ja</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredGuests.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              {filteredGuests.length} von {guests.length} bestätigten Gästen
              {filteredGuests.filter(g => g.status === 'ATTENDED').length > 0 && (
                <span className="ml-2 text-green-600">
                  ({filteredGuests.filter(g => g.status === 'ATTENDED').length} anwesend)
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
