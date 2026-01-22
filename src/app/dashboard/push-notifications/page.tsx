'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function PushNotificationsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    sent: number
    failed: number
    total: number
    message?: string
  } | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    url: '/dashboard',
    recipientType: 'all' as 'all' | 'selected' | 'new',
    selectedUserIds: [] as string[],
    daysSinceRegistration: 7,
    icon: '',
    tag: '',
    requireInteraction: false,
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (response.ok) {
        const usersData = await response.json()
        setUsers(usersData)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Benutzer:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNewUsers = (days: number): User[] => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    return users.filter((user) => {
      const userDate = new Date(user.createdAt)
      return userDate >= cutoffDate
    })
  }

  const handleSend = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('Bitte fülle Titel und Text aus')
      return
    }

    setSending(true)
    setResult(null)

    try {
      let userId: string | undefined = undefined
      let targetUsers: User[] = []

      // Bestimme Ziel-Benutzer
      if (formData.recipientType === 'selected') {
        if (formData.selectedUserIds.length === 0) {
          alert('Bitte wähle mindestens einen Benutzer aus')
          setSending(false)
          return
        }
        // Wenn nur ein User ausgewählt, sende direkt an diesen
        if (formData.selectedUserIds.length === 1) {
          userId = formData.selectedUserIds[0]
        } else {
          // Mehrere User - sende an jeden einzeln
          targetUsers = users.filter((u) => formData.selectedUserIds.includes(u.id))
        }
      } else if (formData.recipientType === 'new') {
        targetUsers = getNewUsers(formData.daysSinceRegistration)
        if (targetUsers.length === 0) {
          alert(`Keine neuen Benutzer in den letzten ${formData.daysSinceRegistration} Tagen gefunden`)
          setSending(false)
          return
        }
      }

      // Sende Notifications
      if (userId) {
        // Einzelner User
        const response = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            body: formData.body,
            url: formData.url,
            userId,
            icon: formData.icon || undefined,
            tag: formData.tag || undefined,
            requireInteraction: formData.requireInteraction,
          }),
        })

        const data = await response.json()
        setResult(data)
      } else if (targetUsers.length > 0) {
        // Mehrere User - sende an jeden einzeln
        const results = await Promise.all(
          targetUsers.map((user) =>
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: formData.title,
                body: formData.body,
                url: formData.url,
                userId: user.id,
                icon: formData.icon || undefined,
                tag: formData.tag || undefined,
                requireInteraction: formData.requireInteraction,
              }),
            }).then((res) => res.json())
          )
        )

        const totalSent = results.reduce((sum, r) => sum + (r.sent || 0), 0)
        const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0)

        setResult({
          success: true,
          sent: totalSent,
          failed: totalFailed,
          total: targetUsers.length,
        })
      } else {
        // Alle User
        const response = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            body: formData.body,
            url: formData.url,
            icon: formData.icon || undefined,
            tag: formData.tag || undefined,
            requireInteraction: formData.requireInteraction,
          }),
        })

        const data = await response.json()
        setResult(data)
      }
    } catch (error) {
      console.error('Fehler beim Senden:', error)
      setResult({
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Fehler beim Senden der Notifications',
      })
    } finally {
      setSending(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter((id) => id !== userId)
        : [...prev.selectedUserIds, userId],
    }))
  }

  const newUsers = getNewUsers(formData.daysSinceRegistration)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Push Notifications senden</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">Neue Notification erstellen</h2>

          <div className="space-y-4">
            {/* Titel */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Titel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Neue Aufgabe zugewiesen"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="z.B. Dir wurde eine neue Aufgabe zugewiesen"
                rows={3}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">URL (optional)</label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="/dashboard"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">URL die beim Klick auf die Notification geöffnet wird</p>
            </div>

            {/* Empfänger-Typ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empfänger <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="all"
                    checked={formData.recipientType === 'all'}
                    onChange={(e) => setFormData({ ...formData, recipientType: 'all' as const })}
                    className="mr-2"
                  />
                  <span>An alle Benutzer</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="selected"
                    checked={formData.recipientType === 'selected'}
                    onChange={(e) => setFormData({ ...formData, recipientType: 'selected' as const })}
                    className="mr-2"
                  />
                  <span>An ausgewählte Benutzer</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="new"
                    checked={formData.recipientType === 'new'}
                    onChange={(e) => setFormData({ ...formData, recipientType: 'new' as const })}
                    className="mr-2"
                  />
                  <span>An neue Benutzer (letzte X Tage)</span>
                </label>
              </div>
            </div>

            {/* Ausgewählte Benutzer */}
            {formData.recipientType === 'selected' && (
              <div className="rounded-lg border border-gray-300 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Benutzer auswählen ({formData.selectedUserIds.length} ausgewählt)
                </label>
                {loading ? (
                  <p className="text-gray-500">Lädt...</p>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {users.map((user) => (
                      <label key={user.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          {user.name} ({user.email})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Neue Benutzer */}
            {formData.recipientType === 'new' && (
              <div className="rounded-lg border border-gray-300 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tage seit Registrierung
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.daysSinceRegistration}
                  onChange={(e) =>
                    setFormData({ ...formData, daysSinceRegistration: parseInt(e.target.value) || 7 })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-2 text-sm text-gray-600">
                  {newUsers.length} neue Benutzer in den letzten {formData.daysSinceRegistration} Tagen gefunden
                </p>
                {newUsers.length > 0 && (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {newUsers.map((user) => (
                      <div key={user.id} className="text-xs text-gray-500">
                        • {user.name} ({user.email}) - {new Date(user.createdAt).toLocaleDateString('de-DE')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Erweiterte Optionen */}
            <details className="rounded-lg border border-gray-300 p-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                Erweiterte Optionen
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Icon URL (optional)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="/icon-192x192.png"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tag (optional)</label>
                  <input
                    type="text"
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="z.B. task-assigned"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Tag für Notification-Gruppierung</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requireInteraction}
                    onChange={(e) => setFormData({ ...formData, requireInteraction: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Benötigt Interaktion (Notification bleibt bis geklickt)</span>
                </label>
              </div>
            </details>

            {/* Ergebnis */}
            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.success
                    ? result.failed === 0
                      ? 'bg-green-50 text-green-800'
                      : 'bg-yellow-50 text-yellow-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                <p className="font-semibold">
                  {result.success ? '✅ Notification gesendet' : '❌ Fehler beim Senden'}
                </p>
                {result.message && <p className="mt-1 text-sm">{result.message}</p>}
                {result.success && (
                  <div className="mt-2 text-sm">
                    <p>Gesendet: {result.sent}</p>
                    <p>Fehlgeschlagen: {result.failed}</p>
                    <p>Gesamt: {result.total}</p>
                  </div>
                )}
              </div>
            )}

            {/* Senden Button */}
            <button
              onClick={handleSend}
              disabled={sending || !formData.title.trim() || !formData.body.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Wird gesendet...' : 'Notification senden'}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-xl bg-blue-50 p-6 text-blue-800">
          <h3 className="mb-2 font-semibold">ℹ️ Hinweise</h3>
          <ul className="space-y-1 text-sm">
            <li>• Notifications werden nur an Benutzer gesendet, die Push Notifications aktiviert haben</li>
            <li>• Neue Benutzer = Benutzer die sich in den letzten X Tagen registriert haben</li>
            <li>• Bei "Ausgewählte Benutzer" können mehrere Benutzer gleichzeitig ausgewählt werden</li>
            <li>• Die URL wird beim Klick auf die Notification geöffnet</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
