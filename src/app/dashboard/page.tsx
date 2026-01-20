'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const categories = [
  {
    id: 'PROTOCOL',
    name: 'Protokol',
    icon: '📋',
    color: 'bg-blue-500',
    description: 'Protokol düzenlemeleri ve kuralları'
  },
  {
    id: 'GUEST_LIST',
    name: 'Davet Listesi',
    icon: '👥',
    color: 'bg-green-500',
    description: 'Misafir listesi ve davetiyeler'
  },
  {
    id: 'GUEST_RECEPTION',
    name: 'Misafir Karşılama',
    icon: '🚪',
    color: 'bg-purple-500',
    description: 'Giriş ve karşılama organizasyonu'
  },
  {
    id: 'SECURITY',
    name: 'Güvenlik',
    icon: '🔒',
    color: 'bg-red-500',
    description: 'Güvenlik önlemleri ve kontroller'
  },
  {
    id: 'HOTEL_COORDINATION',
    name: 'Otel Koordinasyon',
    icon: '🏨',
    color: 'bg-yellow-500',
    description: 'Otel ile koordinasyon ve düzenlemeler'
  },
  {
    id: 'SAHUR_COORDINATION',
    name: 'Sahur Koordinasyon',
    icon: '🌙',
    color: 'bg-indigo-500',
    description: 'Sahur organizasyonu ve planlama'
  },
  {
    id: 'MUSIC_TEAM',
    name: 'Müzik Ekibi',
    icon: '🎵',
    color: 'bg-pink-500',
    description: 'Müzik ekibi ve program koordinasyonu'
  },
  {
    id: 'SPEAKER',
    name: 'Konuşmacı',
    icon: '🎤',
    color: 'bg-teal-500',
    description: 'Konuşmacı organizasyonu ve program'
  },
  {
    id: 'HEADQUARTERS',
    name: 'Genel Merkez Koordinasyon',
    icon: '🏢',
    color: 'bg-gray-500',
    description: 'Genel merkez ile koordinasyon'
  },
  {
    id: 'PROGRAM_FLOW',
    name: 'Program Akışı',
    icon: '⏱️',
    color: 'bg-orange-500',
    description: 'Zaman planlaması ve program akışı'
  }
]

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
  }, [router])

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Iftar Organizasyon Sistemi</h1>
              <p className="text-sm text-gray-500">Titanic Hotel - 27 Şubat 2026</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              // Özel links
              let href = `/dashboard/${category.id.toLowerCase()}`
              if (category.id === 'GUEST_LIST') {
                href = '/dashboard/guests'
              } else if (category.id === 'PROGRAM_FLOW') {
                href = '/dashboard/program_flow'
              }
              
              return (
              <Link
                key={category.id}
                href={href}
                className="group rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
              >
                <div className="mb-4 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${category.color} text-2xl text-white`}>
                    {category.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                </div>
                <p className="text-sm text-gray-600">{category.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
                  Detayları Gör
                  <span className="ml-2">→</span>
                </div>
              </Link>
              )
            })}
          </div>
        </div>

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
