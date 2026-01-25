'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InvitationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [invitations, setInvitations] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [emailConfigs, setEmailConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de')
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<'send' | 'list' | 'templates' | 'config'>('send')
  const [eventId, setEventId] = useState<string>('')

  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null
      }
      return null
    }

    const token = getCookie('auth-token') || localStorage.getItem('auth-token')
    if (!token) {
      router.push('/login')
      return
    }

    setUser({ name: 'User' })
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Lade Events (für eventId)
      const eventsRes = await fetch('/api/events')
      if (eventsRes.ok) {
        const events = await eventsRes.json()
        if (events.length > 0) {
          setEventId(events[0].id)
          await Promise.all([
            loadGuests(events[0].id),
            loadInvitations(events[0].id),
            loadTemplates(),
            loadEmailConfigs(),
          ])
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGuests = async (evId: string) => {
    try {
      const response = await fetch(`/api/guests?eventId=${evId}`)
      if (response.ok) {
        const data = await response.json()
        setGuests(data.filter((g: any) => g.email)) // Nur Gäste mit Email
      }
    } catch (error) {
      console.error('Fehler beim Laden der Gäste:', error)
    }
  }

  const loadInvitations = async (evId: string) => {
    try {
      const response = await fetch(`/api/invitations/list?eventId=${evId}`)
      if (response.ok) {
        const data = await response.json()
        setInvitations(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Einladungen:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
        // Setze Standard-Template für Sprache
        const defaultTemplate = data.find((t: any) => t.language === selectedLanguage && t.isDefault)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id)
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Templates:', error)
    }
  }

  const loadEmailConfigs = async () => {
    try {
      const response = await fetch('/api/email-config')
      if (response.ok) {
        const data = await response.json()
        setEmailConfigs(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Email-Konfigurationen:', error)
    }
  }

  const handleSendInvitations = async () => {
    if (selectedGuests.length === 0) {
      alert('Bitte wählen Sie mindestens einen Gast aus')
      return
    }

    if (!selectedTemplate && !selectedLanguage) {
      alert('Bitte wählen Sie ein Template oder eine Sprache aus')
      return
    }

    if (!eventId) {
      alert('Kein Event ausgewählt')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIds: selectedGuests,
          templateId: selectedTemplate || null,
          language: selectedLanguage,
          eventId,
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Einladungen gesendet: ${result.successful} erfolgreich, ${result.failed} fehlgeschlagen`)
        setSelectedGuests([])
        await loadInvitations(eventId)
      } else {
        alert('Fehler: ' + result.error)
      }
    } catch (error) {
      console.error('Fehler beim Senden:', error)
      alert('Fehler beim Senden der Einladungen')
    } finally {
      setSending(false)
    }
  }

  const getResponseStats = () => {
    const accepted = invitations.filter(i => i.response === 'ACCEPTED').length
    const declined = invitations.filter(i => i.response === 'DECLINED').length
    const pending = invitations.filter(i => i.response === 'PENDING' || !i.response).length
    const opened = invitations.filter(i => i.openedAt).length
    return { accepted, declined, pending, opened, total: invitations.length }
  }

  const stats = getResponseStats()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Einladungen</h1>
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
          >
            Zurück zum Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'send', label: 'Einladungen senden' },
              { id: 'list', label: 'Einladungsliste' },
              { id: 'templates', label: 'Templates' },
              { id: 'config', label: 'Email-Konfiguration' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'send' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Einladungen senden</h2>
            
            {/* Statistiken */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
                <div className="text-sm text-gray-600">Zusagen</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
                <div className="text-sm text-gray-600">Absagen</div>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-gray-600">Ausstehend</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.opened}</div>
                <div className="text-sm text-gray-600">Gelesen</div>
              </div>
            </div>

            {/* Template-Auswahl */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sprache / Template
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value)
                  const defaultTemplate = templates.find(
                    (t: any) => t.language === e.target.value && t.isDefault
                  )
                  setSelectedTemplate(defaultTemplate?.id || '')
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="de">Deutsch</option>
                <option value="tr">Türkisch</option>
                <option value="en">Englisch</option>
                <option value="ar">Arabisch</option>
              </select>
            </div>

            {/* Gäste-Auswahl */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Gäste auswählen ({selectedGuests.length} ausgewählt)
              </label>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-300 p-4">
                {guests.map((guest) => (
                  <label
                    key={guest.id}
                    className="mb-2 flex items-center space-x-2 rounded p-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGuests.includes(guest.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGuests([...selectedGuests, guest.id])
                        } else {
                          setSelectedGuests(selectedGuests.filter(id => id !== guest.id))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {guest.name} ({guest.email})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleSendInvitations}
              disabled={sending || selectedGuests.length === 0}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? 'Wird gesendet...' : `${selectedGuests.length} Einladungen senden`}
            </button>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Einladungsliste</h2>
            
            {/* Filter */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => loadInvitations(eventId)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
              >
                Alle
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=ACCEPTED`)
                    .then(r => r.json())
                    .then(setInvitations)
                }}
                className="rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700 hover:bg-green-200"
              >
                Zusagen
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=DECLINED`)
                    .then(r => r.json())
                    .then(setInvitations)
                }}
                className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200"
              >
                Absagen
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=PENDING`)
                    .then(r => r.json())
                    .then(setInvitations)
                }}
                className="rounded-lg bg-yellow-100 px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-200"
              >
                Ausstehend
              </button>
            </div>

            {/* Tabelle */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gast
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gesendet
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gelesen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Antwort
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Antwort-Datum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {invitation.guest?.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {invitation.guest?.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {invitation.sentAt
                          ? new Date(invitation.sentAt).toLocaleString('de-DE')
                          : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {invitation.openedAt ? (
                          <span className="text-green-600">
                            {new Date(invitation.openedAt).toLocaleString('de-DE')}
                          </span>
                        ) : (
                          <span className="text-gray-400">Nicht gelesen</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {invitation.response === 'ACCEPTED' && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                            Zusage
                          </span>
                        )}
                        {invitation.response === 'DECLINED' && (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">
                            Absage
                          </span>
                        )}
                        {(!invitation.response || invitation.response === 'PENDING') && (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">
                            Ausstehend
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {invitation.respondedAt
                          ? new Date(invitation.respondedAt).toLocaleString('de-DE')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Email-Templates</h2>
            <p className="mb-4 text-sm text-gray-600">
              Templates werden später implementiert. Verwenden Sie vorerst die Standard-Templates.
            </p>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Email-Konfiguration</h2>
            <p className="mb-4 text-sm text-gray-600">
              Email-Konfiguration wird später implementiert.
            </p>
            {emailConfigs.length > 0 && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm">
                  Aktive Konfiguration: {emailConfigs.find(c => c.isActive)?.name || 'Keine'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
