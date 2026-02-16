'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Registration = {
  id: string
  eventSlug: string
  firstName: string
  lastName: string
  district: string | null
  sube: string | null
  phone: string | null
  email: string
  participating: boolean
  notes: string | null
  createdAt: string
  invitationSentAt?: string | null
}

type EventOption = { id: string; title: string; date: string }

export default function RegistrierungenPage() {
  const [list, setList] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'uid-iftar' | 'sube-baskanlari' | 'kadin-kollari' | 'genclik-kollari' | 'fatihgruppe' | 'omerliste'>('uid-iftar')
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [importing, setImporting] = useState<string | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)

  const loadRegistrations = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/registrations')
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRegistrations()
  }, [])

  useEffect(() => {
    const onEmailSent = () => loadRegistrations()
    if (typeof window !== 'undefined') {
      window.addEventListener('email-sent', onEmailSent)
      return () => window.removeEventListener('email-sent', onEmailSent)
    }
  }, [])

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const params = new URLSearchParams({ list: 'true' })
        if (projectId) params.set('projectId', projectId)
        const res = await fetch(`/api/events?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data?.id ? [data] : [])
        const evs = arr.map((e: { id: string; title: string; date: string }) => ({ id: e.id, title: e.title, date: e.date }))
        setEvents(evs)
        setSelectedEventId((prev) => (prev ? prev : evs[0]?.id ?? ''))
      } catch (e) {
        console.error(e)
      }
    }
    loadEvents()
  }, [])

  useEffect(() => {
    const onProjectChange = () => {
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const params = new URLSearchParams({ list: 'true' })
      if (projectId) params.set('projectId', projectId)
      fetch(`/api/events?${params}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const arr = Array.isArray(data) ? data : []
          setEvents(arr.map((e: { id: string; title: string; date: string }) => ({ id: e.id, title: e.title, date: e.date })))
          setSelectedEventId((prev) => (arr.some((e: { id: string }) => e.id === prev) ? prev : arr[0]?.id ?? ''))
        })
        .catch(() => {})
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  const uidIftar = list.filter((r) => r.eventSlug === 'uid-iftar')
  const subeBaskanlari = list.filter((r) => r.eventSlug === 'sube-baskanlari')
  const kadinKollari = list.filter((r) => r.eventSlug === 'kadin-kollari')
  const genclikKollari = list.filter((r) => r.eventSlug === 'genclik-kollari')
  const fatihgruppe = list.filter((r) => r.eventSlug === 'fatihgruppe')
  const omerliste = list.filter((r) => r.eventSlug === 'omerliste')

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return s
    }
  }

  const handleImportToGuests = async (eventSlug: string) => {
    if (!selectedEventId) {
      alert('Bitte wählen Sie zuerst ein Event aus.')
      return
    }
    setImporting(eventSlug)
    try {
      const res = await fetch('/api/registrations/import-to-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Import fehlgeschlagen')
        return
      }
      const msg = [
        `${data.imported} Anmeldung(en) in die Gästeliste übernommen.`,
        data.skipped > 0 ? `${data.skipped} übersprungen (bereits vorhanden).` : '',
        data.duplicateNames?.length ? `Duplikate: ${data.duplicateNames.slice(0, 5).join(', ')}${data.duplicateNames.length > 5 ? ' …' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      alert(msg)
    } catch (e) {
      console.error(e)
      alert('Import fehlgeschlagen')
    } finally {
      setImporting(null)
    }
  }

  const handleFixImportedGuests = async (eventSlug: string) => {
    if (!selectedEventId) {
      alert('Bitte wählen Sie zuerst ein Event aus.')
      return
    }
    if (!confirm('Bereits importierte Gäste korrigieren? Vorname und Nachname werden aus den Anmeldungen in die richtigen Spalten übertragen.')) return
    setFixing(eventSlug)
    try {
      const res = await fetch('/api/registrations/fix-imported-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Korrektur fehlgeschlagen')
        return
      }
      alert(`${data.fixed} Gäste korrigiert.`)
    } catch (e) {
      console.error(e)
      alert('Korrektur fehlgeschlagen')
    } finally {
      setFixing(null)
    }
  }

  const renderTable = (rows: Registration[], showSube: boolean) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Datum</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vorname</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
            {showSube && (
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Şube</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bezirk</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Telefon</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">E-Mail</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Teilnahme</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Einladung per E-Mail</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notizen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showSube ? 10 : 9} className="px-4 py-8 text-center text-sm text-gray-500">
                Noch keine Anmeldungen.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={`hover:bg-gray-50 ${r.invitationSentAt ? 'bg-green-50' : ''}`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatDate(r.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{r.firstName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{r.lastName}</td>
                {showSube && (
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.sube ?? '–'}</td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.district ?? '–'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.phone ?? '–'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {r.participating ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Ja</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Nein</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {r.invitationSentAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" title={`Gesendet: ${formatDate(r.invitationSentAt)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden />
                      {formatDate(r.invitationSentAt)}
                    </span>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600" title={r.notes ?? ''}>
                  {r.notes ?? '–'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Ergebnisse der Anmeldungen</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('uid-iftar')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'uid-iftar'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            UID Iftar ({uidIftar.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sube-baskanlari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'sube-baskanlari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Şube Başkanları ({subeBaskanlari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kadin-kollari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'kadin-kollari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kadın Kolları ({kadinKollari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('genclik-kollari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'genclik-kollari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Gençlik Kolları ({genclikKollari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fatihgruppe')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'fatihgruppe'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Fatihgruppe ({fatihgruppe.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('omerliste')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'omerliste'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Ömerliste ({omerliste.length})
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Lade Anmeldungen …</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="import-event" className="text-sm font-medium text-gray-700">
                  Ziel-Event für Import:
                </label>
                <select
                  id="import-event"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">– Event wählen –</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date ? new Date(ev.date).toLocaleDateString('de-DE') : ''})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleImportToGuests(activeTab)}
                disabled={!selectedEventId || importing !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing === activeTab ? 'Import läuft …' : 'In Gästeliste übernehmen'}
              </button>
              <button
                type="button"
                onClick={() => handleFixImportedGuests(activeTab)}
                disabled={!selectedEventId || fixing !== null}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Vorname und Nachname in die richtigen Spalten übertragen (für bereits importierte Gäste)"
              >
                {fixing === activeTab ? 'Korrektur läuft …' : 'Bereits importierte korrigieren'}
              </button>
              <span className="text-sm text-gray-500">
                Doppelte Namen werden übersprungen.
              </span>
            </div>
            {activeTab === 'uid-iftar' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">UID Iftar</h2>
                {renderTable(uidIftar, false)}
              </>
            ) : activeTab === 'sube-baskanlari' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Şube Başkanları</h2>
                {renderTable(subeBaskanlari, true)}
              </>
            ) : activeTab === 'kadin-kollari' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Kadın Kolları</h2>
                {renderTable(kadinKollari, false)}
              </>
            ) : activeTab === 'fatihgruppe' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Fatihgruppe</h2>
                {renderTable(fatihgruppe, false)}
              </>
            ) : activeTab === 'omerliste' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Ömerliste</h2>
                {renderTable(omerliste, false)}
              </>
            ) : (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Gençlik Kolları</h2>
                {renderTable(genclikKollari, false)}
              </>
            )}
          </>
        )}

        <p className="mt-6 text-sm text-gray-500">
          Links zu den Formularen:{' '}
          <a href="/anmeldung/uid-iftar" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            UID Iftar
          </a>
          {' · '}
          <a href="/anmeldung/sube-baskanlari" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Şube Başkanları
          </a>
          {' · '}
          <a href="/anmeldung/kadin-kollari" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Kadın Kolları
          </a>
          {' · '}
          <a href="/anmeldung/genclik-kollari" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Gençlik Kolları
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/fatihgruppe?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/fatihgruppe'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Fatihgruppe
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/omerliste?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/omerliste'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Ömerliste
          </a>
        </p>
      </main>
    </div>
  )
}
