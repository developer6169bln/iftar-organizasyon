'use client'

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/authClient'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PushNotificationSetup from '@/components/PushNotificationSetup'

// Logo: Nur verwenden wenn Datei in public/ existiert (uid-berlin-logo.png). Sonst header-bg.jpg.
// Kein automatischer HEAD-Check, um 404 in der Konsole zu vermeiden. Logo aktivieren: Datei nach public/ legen und Seite neu laden.
export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accessDenied = searchParams.get('access') === 'denied'
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    totalGuests: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    checklistItems: 0,
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const [categories, setCategories] = useState<any[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📌',
    color: 'bg-slate-500',
    description: '',
    responsibleUserId: '',
  })
  const [logoExists] = useState<boolean>(false)
  const [allowedPageIds, setAllowedPageIds] = useState<string[]>([])
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isProjectOwner, setIsProjectOwner] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string; ownerId: string; isOwner: boolean }[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [currentEvent, setCurrentEvent] = useState<{ title: string; date: string; location: string; status?: string } | null>(null)
  const [hasEdition, setHasEdition] = useState(false) // Hauptnutzer können Projekte anlegen

  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        const token = parts.pop()?.split(';').shift()
        return token || null
      }
      return null
    }

    const checkAuth = async () => {
      const token = getCookie('auth-token') || localStorage.getItem('auth-token')
      if (!token || token.trim() === '') {
        router.push('/login')
        return
      }
      setUser({ name: 'Kullanıcı', email: '' })
      try {
        const storedProjectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const url = storedProjectId ? `/api/me?projectId=${encodeURIComponent(storedProjectId)}` : '/api/me'
        const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          setAllowedPageIds(data.allowedPageIds || [])
          setAllowedCategoryIds(data.allowedCategoryIds || [])
          setIsAdmin(!!data.isAdmin)
          setIsProjectOwner(!!data.isProjectOwner)
          setHasEdition(!!data.user?.editionId)
          const list = data.projects || []
          setProjects(list)
          const isMainUser = !!data.user?.editionId && !data.isAdmin
          // Hauptnutzer: kein Projekt vorauswählen; Admin: Standard = gespeichertes oder erstes Projekt
          let projectId: string | null = null
          if (!isMainUser) {
            const defaultProjectId = list.find((p: { isOwner: boolean }) => p.isOwner)?.id ?? list[0]?.id ?? null
            projectId = storedProjectId && list.some((p: { id: string }) => p.id === storedProjectId) ? storedProjectId : defaultProjectId
          }
          setSelectedProjectId(projectId)
          if (typeof window !== 'undefined') {
            if (projectId) localStorage.setItem('dashboard-project-id', projectId)
            else if (isMainUser) localStorage.removeItem('dashboard-project-id')
          }
        }
      } catch {
        setAllowedPageIds([])
        setAllowedCategoryIds([])
      }
    }

    checkAuth()
    loadCategories()
    loadUsers()
  }, [router])

  // Bei gewähltem Projekt Berechtigungen für dieses Projekt laden (Hauptnutzer sehen dann Bereiche/Seiten/Mitarbeiter)
  useEffect(() => {
    let cancelled = false
    const url = selectedProjectId
      ? `/api/me?projectId=${encodeURIComponent(selectedProjectId)}`
      : '/api/me'
    fetch(url, { credentials: 'include', headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setAllowedPageIds(data.allowedPageIds ?? [])
        setAllowedCategoryIds(data.allowedCategoryIds ?? [])
        setIsProjectOwner(!!data.isProjectOwner)
      })
      .catch(() => {})
    if (!selectedProjectId) setIsProjectOwner(false)
    return () => { cancelled = true }
  }, [selectedProjectId])

  // Statistiken und Event-Infos nur für das gewählte Projekt laden
  useEffect(() => {
    if (!selectedProjectId) {
      setStats({ totalGuests: 0, completedTasks: 0, inProgressTasks: 0, checklistItems: 0 })
      setCurrentEvent(null)
      setLoadingStats(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoadingStats(true)
      setCurrentEvent(null)
      try {
        const eventResponse = await fetch(`/api/events?projectId=${encodeURIComponent(selectedProjectId)}`)
        if (!eventResponse.ok || cancelled) return
        const event = await eventResponse.json()
        if (!event?.id || cancelled) return
        if (!cancelled) {
          setCurrentEvent({
            title: event.title ?? 'Event',
            date: event.date,
            location: event.location ?? '',
            status: event.status,
          })
        }
        const eventId = event.id
        const [guestsRes, tasksRes, checklistRes] = await Promise.all([
          fetch(`/api/guests?eventId=${eventId}&countOnly=true`),
          fetch(`/api/tasks?eventId=${eventId}`),
          fetch(`/api/checklist?eventId=${eventId}`),
        ])
        if (cancelled) return
        let totalGuests = 0
        if (guestsRes.ok) {
          const data = await guestsRes.json()
          totalGuests = typeof data?.count === 'number' ? data.count : (Array.isArray(data) ? data.length : 0)
        }
        let completedTasks = 0
        let inProgressTasks = 0
        if (tasksRes.ok) {
          const tasks = await tasksRes.json()
          completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length
          inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length
        }
        let checklistItems = 0
        if (checklistRes.ok) {
          const checklist = await checklistRes.json()
          checklistItems = checklist.length
        }
        if (!cancelled) {
          setStats({ totalGuests, completedTasks, inProgressTasks, checklistItems })
        }
      } catch (e) {
        if (!cancelled) console.error('Statistik yükleme hatası:', e)
      } finally {
        if (!cancelled) setLoadingStats(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [selectedProjectId])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const usersData = await response.json()
        setUsers(usersData)
      }
    } catch (error) {
      console.error('Benutzer yükleme hatası:', error)
    }
  }

  const loadCategories = async () => {
    try {
      setLoadingCategories(true)
      const url = selectedProjectId ? `/api/categories?projectId=${encodeURIComponent(selectedProjectId)}` : '/api/categories'
      const response = await fetch(url)
      if (response.ok) {
        const categoriesData = await response.json()
        if (categoriesData.length === 0) {
          // Initialisiere Standard-Categories
          await initializeDefaultCategories()
          // Lade erneut
          const reloadResponse = await fetch(url)
          if (reloadResponse.ok) {
            const reloaded = await reloadResponse.json()
            setCategories(reloaded)
          }
        } else {
          setCategories(categoriesData)
        }
      }
    } catch (error) {
      console.error('Kategorien yükleme hatası:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  const initializeDefaultCategories = async () => {
    const defaultCategories = [
      { categoryId: 'PROTOCOL', name: 'Protokol', icon: '📋', color: 'bg-blue-500', description: 'Protokol düzenlemeleri ve kuralları', order: 1 },
      { categoryId: 'GUEST_LIST', name: 'Davet Listesi', icon: '👥', color: 'bg-green-500', description: 'Misafir listesi ve davetiyeler', order: 2 },
      { categoryId: 'GUEST_RECEPTION', name: 'Misafir Karşılama', icon: '🚪', color: 'bg-purple-500', description: 'Giriş ve karşılama organizasyonu', order: 3 },
      { categoryId: 'SECURITY', name: 'Güvenlik', icon: '🔒', color: 'bg-red-500', description: 'Güvenlik önlemleri ve kontroller', order: 4 },
      { categoryId: 'HOTEL_COORDINATION', name: 'Otel Koordinasyon', icon: '🏨', color: 'bg-yellow-500', description: 'Otel ile koordinasyon ve düzenlemeler', order: 5 },
      { categoryId: 'SAHUR_COORDINATION', name: 'Sahur Koordinasyon', icon: '🌙', color: 'bg-indigo-500', description: 'Sahur organizasyonu ve planlama', order: 6 },
      { categoryId: 'MUSIC_TEAM', name: 'Müzik Ekibi', icon: '🎵', color: 'bg-pink-500', description: 'Müzik ekibi ve program koordinasyonu', order: 7 },
      { categoryId: 'SPEAKER', name: 'Konuşmacı', icon: '🎤', color: 'bg-teal-500', description: 'Konuşmacı organizasyonu ve program', order: 8 },
      { categoryId: 'HEADQUARTERS', name: 'Genel Merkez Koordinasyon', icon: '🏢', color: 'bg-gray-500', description: 'Genel merkez ile koordinasyon', order: 9 },
      { categoryId: 'PROGRAM_FLOW', name: 'Program Akışı', icon: '⏱️', color: 'bg-orange-500', description: 'Zaman planlaması ve program akışı', order: 10 },
    ]

    for (const cat of defaultCategories) {
      try {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cat),
        })
      } catch (error) {
        console.error(`Fehler beim Erstellen der Kategorie ${cat.categoryId}:`, error)
      }
    }
  }


  const handleLogout = () => {
    // Cookie'yi sil
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // localStorage'dan da sil
    localStorage.removeItem('auth-token')
    // Zur Login-Seite weiterleiten
    window.location.href = '/login'
  }

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }
    if (!selectedProjectId) {
      alert('Bitte wählen Sie zuerst ein Projekt aus.')
      return
    }

    try {
      const eventResponse = await fetch(`/api/events?projectId=${encodeURIComponent(selectedProjectId)}`)
      if (!eventResponse.ok) {
        alert('Event konnte nicht geladen werden')
        return
      }
      const event = await eventResponse.json()
      const eventId = event?.id
      if (!eventId) {
        alert('Kein Event im gewählten Projekt.')
        return
      }

      const categoryId = `CUSTOM_${Date.now()}`
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          name: newCategory.name,
          icon: newCategory.icon,
          color: newCategory.color,
          description: newCategory.description || '',
          responsibleUserId: newCategory.responsibleUserId || undefined,
          order: categories.length + 1,
        }),
      })

      if (response.ok) {
        const created = await response.json()
        setCategories([...categories, created])
        setNewCategory({ name: '', icon: '📌', color: 'bg-slate-500', description: '', responsibleUserId: '' })
        setShowAddCategoryModal(false)
        
        // Erstelle Standard-Inhalte für die neue Kategorie
        await createDefaultContentForCategory(eventId, categoryId, newCategory.name)
      } else {
        const error = await response.json()
        alert(error.error || 'Kategorie konnte nicht erstellt werden')
      }
    } catch (error) {
      console.error('Kategorie erstellen Fehler:', error)
      alert('Kategorie konnte nicht erstellt werden')
    }
  }

  const handleEditCategory = (category: any) => {
    setEditingCategory(category)
    setShowEditCategoryModal(true)
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return

    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory.id,
          name: editingCategory.name,
          icon: editingCategory.icon,
          color: editingCategory.color,
          description: editingCategory.description || '',
          responsibleUserId: editingCategory.responsibleUserId || undefined,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setCategories(categories.map(cat => cat.id === editingCategory.id ? updated : cat))
        setShowEditCategoryModal(false)
        setEditingCategory(null)
      } else {
        const error = await response.json()
        alert(error.error || 'Kategorie konnte nicht aktualisiert werden')
      }
    } catch (error) {
      console.error('Kategorie aktualisieren Fehler:', error)
      alert('Kategorie konnte nicht aktualisiert werden')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm(`Möchten Sie den Bereich "${categories.find(c => c.id === categoryId)?.name}" wirklich löschen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/categories?id=${categoryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCategories(categories.filter(cat => cat.id !== categoryId))
      } else {
        const error = await response.json()
        alert(error.error || 'Kategorie konnte nicht gelöscht werden')
      }
    } catch (error) {
      console.error('Kategorie löschen Fehler:', error)
      alert('Kategorie konnte nicht gelöscht werden')
    }
  }

  const createDefaultContentForCategory = async (eventId: string, categoryId: string, categoryName: string) => {
    try {
      // Standard Checklist Items
      const defaultChecklist = [
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Vorbereitung abgeschlossen`,
          description: 'Alle Vorbereitungen für diesen Bereich sind abgeschlossen',
          status: 'NOT_STARTED',
        },
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Koordination mit Team`,
          description: 'Team-Koordination und Aufgabenverteilung erfolgt',
          status: 'NOT_STARTED',
        },
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Finale Überprüfung`,
          description: 'Finale Überprüfung aller Details vor dem Event',
          status: 'NOT_STARTED',
        },
      ]

      // Standard Tasks
      const defaultTasks = [
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Planung und Koordination`,
          description: 'Planung und Koordination für diesen Bereich durchführen',
          priority: 'HIGH',
          status: 'PENDING',
        },
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Team-Zusammenstellung`,
          description: 'Team für diesen Bereich zusammenstellen und Aufgaben zuweisen',
          priority: 'MEDIUM',
          status: 'PENDING',
        },
        {
          eventId,
          category: categoryId,
          title: `${categoryName} - Ressourcen planen`,
          description: 'Benötigte Ressourcen und Materialien planen',
          priority: 'MEDIUM',
          status: 'PENDING',
        },
      ]

      // Standard Notes
      const defaultNotes = [
        {
          eventId,
          category: categoryId,
          taskId: null,
          type: 'MEETING',
          title: `${categoryName} - Erstes Planungstreffen`,
          content: 'Erstes Planungstreffen für diesen Bereich durchführen und Ziele definieren',
        },
      ]

      // Erstelle Checklist Items
      for (const item of defaultChecklist) {
        await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        }).catch(() => {})
      }

      // Erstelle Tasks
      for (const task of defaultTasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        }).catch(() => {})
      }

      // Erstelle Notes
      for (const note of defaultNotes) {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note),
        }).catch(() => {})
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Standard-Inhalte:', error)
      // Nicht blockieren, wenn Standard-Inhalte fehlschlagen
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="relative bg-cover bg-center bg-no-repeat shadow-sm"
        style={{
          backgroundImage: logoExists ? 'url(/uid-berlin-logo.png)' : 'url(/header-bg.jpg)',
          backgroundSize: logoExists === true ? 'contain' : 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#215F7D',
          minHeight: '200px',
        }}
      >
        {/* Overlay für bessere Lesbarkeit (optional, da Bild bereits dunklen Hintergrund hat) */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-48 items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">UID BERLIN EVENTS</h1>
              {selectedProjectId && currentEvent && (
                <p className="mt-2 text-lg text-white drop-shadow-md">
                  {currentEvent.title} · {new Date(currentEvent.date).toLocaleDateString('de-DE')} · {currentEvent.location}
                </p>
              )}
              {projects.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm text-white drop-shadow-md">Projekt:</label>
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => {
                      const id = e.target.value || null
                      setSelectedProjectId(id)
                      if (typeof window !== 'undefined') {
                        if (id) localStorage.setItem('dashboard-project-id', id)
                        else localStorage.removeItem('dashboard-project-id')
                        window.dispatchEvent(new CustomEvent('dashboard-project-changed'))
                      }
                    }}
                    className="rounded border border-white/30 bg-white/20 px-2 py-1 text-sm text-white focus:border-white focus:outline-none"
                  >
                    <option value="">— auswählen —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isOwner ? '(Inhaber)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {user?.name && (
                <span className="text-sm font-medium text-white/90">{user.name}</span>
              )}
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 shadow-lg"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {accessDenied && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            Sie haben keinen Zugriff auf diesen Bereich. Die Berechtigungen werden vom Administrator festgelegt.
          </div>
        )}
        {!isAdmin && !hasEdition && projects.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <strong>Konto wartet auf Freischaltung:</strong> Der App-Betreiber weist Ihnen eine Edition zu und aktiviert Ihr Konto. Danach können Sie Projekte anlegen und Projektmitarbeiter verwalten.
          </div>
        )}
        {hasEdition && !isAdmin && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-800">
            <strong>Administrator nur für Ihren Account:</strong> Sie verwalten ausschließlich Ihre eigenen Projekte und alle Daten, die Sie dort anlegen (Gäste, Aufgaben, Listen, Einladungen). Sie sehen keine Projekte oder Benutzer anderer Hauptnutzer – nur der App-Betreiber hat die Gesamtübersicht.
          </div>
        )}
        {/* Quick Links – nur erlaubte Seiten (Admin sieht alle) */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/dashboard/registrierungen"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-2xl text-white">
                📝
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Anmeldungen (UID Iftar / Şube Başkanları)</h3>
                <p className="text-sm text-gray-600">
                  Ergebnisse der öffentlichen Registrierungsformulare einsehen
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          {(isAdmin || allowedPageIds.includes('invitations')) && (
          <Link
            href="/dashboard/invitations"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-2xl text-white">
                ✉️
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Einladungen</h3>
                <p className="text-sm text-gray-600">
                  Einladungen senden und verwalten
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('checkin')) && (
          <Link
            href="/dashboard/checkin"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-2xl text-white">
                ✓
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Eingangskontrolle</h3>
                <p className="text-sm text-gray-600">
                  Liste der Gäste mit Zusage (ACCEPTED)
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('reports')) && (
          <Link
            href="/dashboard/reports"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-700 text-2xl text-white">
                📑
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Berichte</h3>
                <p className="text-sm text-gray-600">
                  Aufgaben nach Benutzer/Bereich als PDF exportieren
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('audit-logs')) && (
          <Link
            href="/dashboard/audit-logs"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-700 text-2xl text-white">
                📋
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Audit-Logs</h3>
                <p className="text-sm text-gray-600">
                  Benutzeraktionen nachverfolgen und protokollieren
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('push-notifications')) && (
          <Link
            href="/dashboard/push-notifications"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600 text-2xl text-white">
                📢
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
                <p className="text-sm text-gray-600">
                  Notifications an Benutzer senden
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('vip-namensschilder')) && (
          <Link
            href="/dashboard/vip-namensschilder"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-600 text-2xl text-white">
                👑
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">VIP Liste und Namensschilder</h3>
                <p className="text-sm text-gray-600">
                  VIP-Gäste verwalten und Namensschilder als PDF erstellen
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('tischplanung')) && (
          <Link
            href="/dashboard/tischplanung"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600 text-2xl text-white">
                🪑
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Tischplanung</h3>
                <p className="text-sm text-gray-600">
                  Grundriss hochladen, Tische und Podeste anordnen, Gäste zuweisen
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('foto-video')) && (
          <Link
            href="/dashboard/foto-video"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-600 text-2xl text-white">
                📷
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Foto & Video</h3>
                <p className="text-sm text-gray-600">
                  Fotos und Videos hochladen, mit Titel und Kommentar versehen, Teilen-Status verwalten
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('media-upload')) && (
          <Link
            href="/dashboard/media-upload"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-600 text-2xl text-white">
                📤
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Media-Upload</h3>
                <p className="text-sm text-gray-600">
                  Projekt und Event wählen, dann Fotos und Videos mit Titel, Kommentar und Teilen-Status hochladen
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('etkinlik-formu')) && (
          <Link
            href="/dashboard/etkinlik-formu"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-2xl text-white">
                📋
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Etkinlik Formu (JotForm)</h3>
                <p className="text-sm text-gray-600">
                  Formular pro Projekt ausfüllen und speichern; berechtigte Nutzer können an JotForm senden
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('etkinlik-raporu')) && (
          <Link
            href="/dashboard/etkinlik-raporu"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600 text-2xl text-white">
                📄
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Etkinlik Raporu (JotForm)</h3>
                <p className="text-sm text-gray-600">
                  Bericht pro Projekt ausfüllen und speichern; berechtigte Nutzer können an JotForm senden
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {(isAdmin || allowedPageIds.includes('room-reservations')) && (
          <Link
            href="/dashboard/room-reservations"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600 text-2xl text-white">
                🏠
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Raum-Reservierungen</h3>
                <p className="text-sm text-gray-600">
                  Räume verwalten (Admin), Reservierungen anlegen und aktuelle Buchungen einsehen
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
          {/* Admin-Bereich für Hauptnutzer: immer sichtbar (Projekte & Mitarbeiter) */}
          <Link
            href="/dashboard/projects"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg border-2 border-indigo-200"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-2xl text-white">
                📁
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Ihr Admin-Bereich: Projekte & Mitarbeiter</h3>
                <p className="text-sm text-gray-600">
                  {projects.length > 0
                    ? 'Projekte verwalten, Mitarbeiter anlegen, zu Projekten zuweisen, Rollen und Berechtigungen vergeben'
                    : hasEdition
                      ? 'Neues Projekt anlegen, Mitarbeiter einladen und Berechtigungen vergeben'
                      : 'Projekte und Projektmitarbeiter verwalten (nach Freischaltung durch den App-Betreiber)'}
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          {isAdmin && (
          <Link
            href="/dashboard/admin"
            className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg border-2 border-amber-400"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-600 text-2xl text-white">
                ⚙️
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Admin & Statistik</h3>
                <p className="text-sm text-gray-600">
                  Benutzer verwalten, Berechtigungen, Editionen, Top-User-Statistik
                </p>
              </div>
              <div className="text-indigo-600">→</div>
            </div>
          </Link>
          )}
        </div>

        {/* Push Notifications Setup */}
        <div className="mb-8">
          <PushNotificationSetup />
        </div>

        {/* Event Info Card – nur wenn ein Projekt ausgewählt ist */}
        {selectedProjectId && currentEvent && (
          <div className="mb-8 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold">Event-Informationen</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm opacity-90">Titel</p>
                <p className="text-xl font-semibold">{currentEvent.title}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Datum</p>
                <p className="text-xl font-semibold">{new Date(currentEvent.date).toLocaleDateString('de-DE')}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Ort</p>
                <p className="text-xl font-semibold">{currentEvent.location || '–'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Organizasyon Alanları</h2>
          {loadingCategories ? (
            <p className="text-gray-500">Kategorien werden geladen...</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categories
                .filter(cat => cat.isActive)
                .filter(cat => isAdmin || allowedCategoryIds.includes(cat.categoryId))
                .map((category) => {
                // Özel links
                let href = `/dashboard/${category.categoryId.toLowerCase()}`
                if (category.categoryId === 'GUEST_LIST') {
                  href = '/dashboard/guests'
                } else if (category.categoryId === 'PROGRAM_FLOW') {
                  href = '/dashboard/program_flow'
                }
                
                return (
                <div key={category.id} className="group relative rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg">
                  {(isAdmin || isProjectOwner) && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="rounded bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
                      title="Bearbeiten"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200"
                      title="Löschen"
                    >
                      🗑
                    </button>
                  </div>
                  )}
                  <Link href={href} className="block">
                    <div className="mb-4 flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${category.color} text-2xl text-white`}>
                        {category.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                        {category.responsibleUser && (
                          <p className="mt-1 text-xs text-gray-500">
                            👤 Verantwortlich: {category.responsibleUser.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{category.description}</p>
                    <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
                      Detayları Gör
                      <span className="ml-2">→</span>
                    </div>
                  </Link>
                </div>
                )
              })}
              
              {/* Plus-Zeichen zum Hinzufügen – für Admin und Projekt-Inhaber */}
              {(isAdmin || isProjectOwner) && (
              <button
              onClick={() => setShowAddCategoryModal(true)}
              className="group flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 transition-all hover:border-indigo-500 hover:bg-indigo-50"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-3xl text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                +
              </div>
              <p className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">
                Yeni Alan Ekle
              </p>
              </button>
              )}
            </div>
          )}
        </div>

        {/* Modal zum Hinzufügen neuer Kategorie */}
        {showAddCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold">Yeni Organizasyon Alanı Ekle</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddCategory()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    required
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="z.B. Catering, Transport, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Icon</label>
                  <input
                    type="text"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="📌"
                  />
                  <p className="mt-1 text-xs text-gray-500">Emoji oder Unicode-Zeichen</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Farbe</label>
                  <select
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="bg-slate-500">Grau</option>
                    <option value="bg-blue-500">Blau</option>
                    <option value="bg-green-500">Grün</option>
                    <option value="bg-purple-500">Lila</option>
                    <option value="bg-red-500">Rot</option>
                    <option value="bg-yellow-500">Gelb</option>
                    <option value="bg-indigo-500">Indigo</option>
                    <option value="bg-pink-500">Rosa</option>
                    <option value="bg-teal-500">Türkis</option>
                    <option value="bg-orange-500">Orange</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Kurze Beschreibung des Bereichs..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hauptverantwortlicher</label>
                  <select
                    value={newCategory.responsibleUserId}
                    onChange={(e) => setNewCategory({ ...newCategory, responsibleUserId: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Kein Verantwortlicher</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Hinzufügen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategoryModal(false)
                      setNewCategory({ name: '', icon: '📌', color: 'bg-slate-500', description: '', responsibleUserId: '' })
                    }}
                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal zum Bearbeiten der Kategorie */}
        {showEditCategoryModal && editingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold">Organizasyon Alanı Bearbeiten</h2>
              <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Icon</label>
                  <input
                    type="text"
                    value={editingCategory.icon}
                    onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="📌"
                  />
                  <p className="mt-1 text-xs text-gray-500">Emoji oder Unicode-Zeichen</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Farbe</label>
                  <select
                    value={editingCategory.color}
                    onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="bg-slate-500">Grau</option>
                    <option value="bg-blue-500">Blau</option>
                    <option value="bg-green-500">Grün</option>
                    <option value="bg-purple-500">Lila</option>
                    <option value="bg-red-500">Rot</option>
                    <option value="bg-yellow-500">Gelb</option>
                    <option value="bg-indigo-500">Indigo</option>
                    <option value="bg-pink-500">Rosa</option>
                    <option value="bg-teal-500">Türkis</option>
                    <option value="bg-orange-500">Orange</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    value={editingCategory.description || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Kurze Beschreibung des Bereichs..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Hauptverantwortlicher</label>
                    <a
                      href="/register"
                      target="_blank"
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      + Neuer Benutzer
                    </a>
                  </div>
                  <select
                    value={editingCategory.responsibleUserId || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, responsibleUserId: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Kein Verantwortlicher</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCategoryModal(false)
                      setEditingCategory(null)
                    }}
                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <p className="text-sm text-gray-600">Toplam Misafir</p>
            {loadingStats ? (
              <p className="mt-2 text-3xl font-bold text-gray-400">...</p>
            ) : (
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalGuests}</p>
            )}
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <p className="text-sm text-gray-600">Tamamlanan Görevler</p>
            {loadingStats ? (
              <p className="mt-2 text-3xl font-bold text-gray-400">...</p>
            ) : (
              <p className="mt-2 text-3xl font-bold text-green-600">{stats.completedTasks}</p>
            )}
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <p className="text-sm text-gray-600">Devam Eden Görevler</p>
            {loadingStats ? (
              <p className="mt-2 text-3xl font-bold text-gray-400">...</p>
            ) : (
              <p className="mt-2 text-3xl font-bold text-yellow-600">{stats.inProgressTasks}</p>
            )}
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <p className="text-sm text-gray-600">Checklist Öğeleri</p>
            {loadingStats ? (
              <p className="mt-2 text-3xl font-bold text-gray-400">...</p>
            ) : (
              <p className="mt-2 text-3xl font-bold text-blue-600">{stats.checklistItems}</p>
            )}
          </div>
        </div>

        <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          © <a href="mailto:yasin@korkut.de" className="text-indigo-600 hover:underline">yasin@korkut.de</a>
        </footer>
      </main>
    </div>
  )
}
