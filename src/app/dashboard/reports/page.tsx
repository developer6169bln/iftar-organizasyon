'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type User = { id: string; name: string; email: string }
type Category = { id: string; categoryId: string; name: string; responsibleUser?: { id: string; name: string } | null }

type ReportType = 'all_by_user' | 'user' | 'category' | 'responsible'

export default function ReportsPage() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [type, setType] = useState<ReportType>('all_by_user')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedResponsibleUserId, setSelectedResponsibleUserId] = useState<string>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const ev = await fetch(eventsUrl).then((r) => (r.ok ? r.json() : null))
        if (ev?.id) setEventId(ev.id)
      } catch {}

      try {
        const u = await fetch('/api/users').then((r) => (r.ok ? r.json() : []))
        setUsers(u || [])
      } catch {}

      try {
        const c = await fetch('/api/categories').then((r) => (r.ok ? r.json() : []))
        setCategories(c || [])
      } catch {}
    }
    load()
  }, [])

  const canDownload = useMemo(() => {
    if (!eventId) return false
    if (type === 'user') return !!selectedUserId
    if (type === 'category') return !!selectedCategoryId
    if (type === 'responsible') return !!selectedResponsibleUserId
    return true
  }, [eventId, type, selectedUserId, selectedCategoryId, selectedResponsibleUserId])

  const downloadPdf = async () => {
    if (!eventId) return
    setDownloading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', type)
      params.set('eventId', eventId)
      if (type === 'user') params.set('userId', selectedUserId)
      if (type === 'category') params.set('categoryId', selectedCategoryId)
      if (type === 'responsible') params.set('responsibleUserId', selectedResponsibleUserId)

      const res = await fetch(`/api/reports?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || data?.details || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bericht-${type}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || 'PDF konnte nicht erstellt werden')
    } finally {
      setDownloading(false)
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
              <h1 className="text-2xl font-bold text-gray-900">Berichte</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Report-Typ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="all_by_user">Alle Aufgaben (gruppiert nach Benutzer)</option>
                <option value="user">Aufgaben eines Benutzers</option>
                <option value="category">Bereichsbericht (Bereich wählen)</option>
                <option value="responsible">Hauptverantwortlicher (alle zugewiesenen Bereiche)</option>
              </select>
            </div>

            {type === 'user' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Benutzer</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Bitte wählen…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type === 'responsible' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Hauptverantwortlicher</label>
                <select
                  value={selectedResponsibleUserId}
                  onChange={(e) => setSelectedResponsibleUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Bitte wählen…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type === 'category' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Bereich</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Bitte wählen…</option>
                  {categories
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.categoryId}>
                        {c.name}
                        {c.responsibleUser ? ` (👤 ${c.responsibleUser.name})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={!canDownload || downloading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {downloading ? 'PDF wird erstellt…' : 'PDF herunterladen'}
            </button>
            <p className="text-xs text-gray-500">
              Im PDF erscheint rechts eine Spalte „Erledigt“ zum Abhaken.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

