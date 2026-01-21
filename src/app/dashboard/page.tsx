'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
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

  useEffect(() => {
    // Token kontrolü - Cookie veya localStorage'dan oku
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

    const checkAuth = () => {
      // Önce Cookie'den kontrol et
      let token = getCookie('auth-token')
      
      // Cookie yoksa localStorage'dan kontrol et
      if (!token) {
        token = localStorage.getItem('auth-token')
      }

      if (!token || token.trim() === '') {
        router.push('/login')
        return
      }
      
      // Token var, kullanıcı bilgilerini set et
      setUser({ name: 'Kullanıcı', email: '' })
    }

    checkAuth()
    loadStatistics()
    loadCategories()
    loadUsers()
  }, [router])

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
      const response = await fetch('/api/categories')
      if (response.ok) {
        const categoriesData = await response.json()
        if (categoriesData.length === 0) {
          // Initialisiere Standard-Categories
          await initializeDefaultCategories()
          // Lade erneut
          const reloadResponse = await fetch('/api/categories')
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

  const loadStatistics = async () => {
    try {
      // Event holen
      const eventResponse = await fetch('/api/events')
      if (!eventResponse.ok) return
      const event = await eventResponse.json()
      const eventId = event.id

      // Parallel alle Statistiken laden
      const [guestsRes, tasksRes, checklistRes] = await Promise.all([
        fetch(`/api/guests?eventId=${eventId}`),
        fetch(`/api/tasks?eventId=${eventId}`),
        fetch(`/api/checklist?eventId=${eventId}`),
      ])

      let totalGuests = 0
      if (guestsRes.ok) {
        const guests = await guestsRes.json()
        totalGuests = guests.length
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

      setStats({
        totalGuests,
        completedTasks,
        inProgressTasks,
        checklistItems,
      })
    } catch (error) {
      console.error('Statistik yükleme hatası:', error)
    } finally {
      setLoadingStats(false)
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

    try {
      // Event holen für Standard-Inhalte
      const eventResponse = await fetch('/api/events')
      if (!eventResponse.ok) {
        alert('Event konnte nicht geladen werden')
        return
      }
      const event = await eventResponse.json()
      const eventId = event.id

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
          backgroundImage: 'url(/uid-berlin-logo.png)',
          backgroundSize: 'contain',
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
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">Iftar Organizasyon Sistemi</h1>
              <p className="mt-2 text-lg text-white drop-shadow-md">Titanic Hotel - 27 Şubat 2026</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 shadow-lg"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Quick Links */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>

        {/* Event Info Card */}
        <div className="mb-8 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-lg">
          <h2 className="text-2xl font-bold">Etkinlik Bilgileri</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm opacity-90">Tarih</p>
              <p className="text-xl font-semibold">27 Şubat 2026</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Lokasyon</p>
              <p className="text-xl font-semibold">Titanic Hotel</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Durum</p>
              <p className="text-xl font-semibold">Planlama Aşamasında</p>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Organizasyon Alanları</h2>
          {loadingCategories ? (
            <p className="text-gray-500">Kategorien werden geladen...</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categories.filter(cat => cat.isActive).map((category) => {
                // Özel links
                let href = `/dashboard/${category.categoryId.toLowerCase()}`
                if (category.categoryId === 'GUEST_LIST') {
                  href = '/dashboard/guests'
                } else if (category.categoryId === 'PROGRAM_FLOW') {
                  href = '/dashboard/program_flow'
                }
                
                return (
                <div key={category.id} className="group relative rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg">
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
              
              {/* Plus-Zeichen zum Hinzufügen */}
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
      </main>
    </div>
  )
}
