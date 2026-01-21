'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entityType: string | null
  entityId: string | null
  eventId: string | null
  category: string | null
  description: string | null
  oldValues: any
  newValues: any
  ipAddress: string | null
  userAgent: string | null
  url: string | null
  metadata: any
  createdAt: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 50

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.entityType) params.append('entityType', filters.entityType)
      if (filters.action) params.append('action', filters.action)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      params.append('limit', limit.toString())
      params.append('offset', (page * limit).toString())

      const response = await fetch(`/api/audit-logs?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setTotal(data.total)
      } else {
        console.error('Fehler beim Laden der Logs')
      }
    } catch (error) {
      console.error('Fehler:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, filters])

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      case 'VIEW':
        return 'bg-gray-100 text-gray-800'
      case 'CLICK':
        return 'bg-purple-100 text-purple-800'
      case 'LOGIN':
        return 'bg-indigo-100 text-indigo-800'
      case 'LOGOUT':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit-Logs</h1>
            <p className="mt-2 text-gray-600">Nachverfolgung aller Benutzeraktionen</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            ← Zurück
          </Link>
        </div>

        {/* Filter */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Filter</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">User ID</label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="User ID..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Alle</option>
                <option value="GUEST">Gast</option>
                <option value="TASK">Aufgabe</option>
                <option value="CHECKLIST">Checklist</option>
                <option value="NOTE">Notiz</option>
                <option value="CATEGORY">Kategorie</option>
                <option value="USER">Benutzer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aktion</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Alle</option>
                <option value="CREATE">Erstellen</option>
                <option value="UPDATE">Aktualisieren</option>
                <option value="DELETE">Löschen</option>
                <option value="VIEW">Anzeigen</option>
                <option value="CLICK">Klick</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Von Datum</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bis Datum</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setFilters({
                userId: '',
                entityType: '',
                action: '',
                startDate: '',
                endDate: '',
              })
              setPage(0)
            }}
            className="mt-4 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Filter zurücksetzen
          </button>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl bg-white shadow-md">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Logs ({total})</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  ← Zurück
                </button>
                <span className="text-sm text-gray-600">
                  Seite {page + 1} von {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  Weiter →
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-gray-500">Lädt...</p>
            ) : logs.length === 0 ? (
              <p className="text-gray-500">Keine Logs gefunden</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Zeit</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">User</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Aktion</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Entity</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Beschreibung</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.userEmail || log.userId || 'Unbekannt'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.entityType && log.entityId ? (
                            <span>
                              {log.entityType} ({log.entityId.slice(0, 8)}...)
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.ipAddress || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
