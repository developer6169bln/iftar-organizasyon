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
}

export default function RegistrierungenPage() {
  const [list, setList] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'uid-iftar' | 'sube-baskanlari' | 'kadin-kollari' | 'genclik-kollari'>('uid-iftar')

  useEffect(() => {
    const load = async () => {
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
    load()
  }, [])

  const uidIftar = list.filter((r) => r.eventSlug === 'uid-iftar')
  const subeBaskanlari = list.filter((r) => r.eventSlug === 'sube-baskanlari')
  const kadinKollari = list.filter((r) => r.eventSlug === 'kadin-kollari')
  const genclikKollari = list.filter((r) => r.eventSlug === 'genclik-kollari')

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
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notizen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showSube ? 9 : 8} className="px-4 py-8 text-center text-sm text-gray-500">
                Noch keine Anmeldungen.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
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
        </div>

        {loading ? (
          <p className="text-gray-500">Lade Anmeldungen …</p>
        ) : activeTab === 'uid-iftar' ? (
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
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Gençlik Kolları</h2>
            {renderTable(genclikKollari, false)}
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
        </p>
      </main>
    </div>
  )
}
