'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const programTypes = [
  { value: 'SPEECH', label: 'Konuşma', icon: '🎤' },
  { value: 'MUSIC', label: 'Müzik', icon: '🎵' },
  { value: 'EZAN', label: 'Ezan', icon: '🕌' },
  { value: 'QURAN', label: 'Kuran Okuma', icon: '📖' },
  { value: 'HITABET', label: 'Hitabet', icon: '💬' },
  { value: 'IFTAR_START', label: 'Iftar Başlangıcı', icon: '🌙' },
  { value: 'SUNUCU', label: 'Sunucu', icon: '🎙️' },
]

const musicTypes = [
  'İlahi',
  'Tasavvuf',
  'Fon Müziği',
  'Canlı Müzik',
]

export default function ProgramFlowPage() {
  const router = useRouter()
  const [programItems, setProgramItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [eventId, setEventId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    type: 'SPEECH',
    title: '',
    speakerName: '',
    topic: '',
    duration: 10,
    startTime: '',
    order: 0,
    musicType: '',
    notes: '',
  })

  useEffect(() => {
    loadEventAndData()
  }, [])

  useEffect(() => {
    const onProjectChange = () => loadEventAndData()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  const loadEventAndData = async () => {
    try {
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
      const eventResponse = await fetch(eventsUrl)
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        if (event?.id) {
          setEventId(event.id)
          await loadProgramItems(event.id)
        }
      }
    } catch (error) {
      console.error('Event yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProgramItems = async (eventId: string) => {
    try {
      const response = await fetch(`/api/program?eventId=${eventId}`)
      if (response.ok) {
        const items = await response.json()
        setProgramItems(items)
      }
    } catch (error) {
      console.error('Program öğeleri yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) return

    try {
      const url = editingItem 
        ? '/api/program' 
        : '/api/program'
      
      const method = editingItem ? 'PATCH' : 'POST'
      
      const payload: any = {
        eventId,
        type: formData.type,
        title: formData.title,
        duration: parseInt(formData.duration.toString()),
        startTime: formData.startTime,
        order: parseInt(formData.order.toString()),
      }

      if (editingItem) {
        payload.id = editingItem
      }

      if (formData.speakerName) payload.speakerName = formData.speakerName
      if (formData.topic) payload.topic = formData.topic
      if (formData.musicType) payload.musicType = formData.musicType
      if (formData.notes) payload.notes = formData.notes

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const item = await response.json()
        if (editingItem) {
          setProgramItems(programItems.map(i => i.id === editingItem ? item : i))
        } else {
          setProgramItems([...programItems, item].sort((a, b) => a.order - b.order))
        }
        setShowModal(false)
        setEditingItem(null)
        resetForm()
        await loadProgramItems(eventId)
      } else {
        const error = await response.json()
        alert(error.error || 'Kayıt başarısız')
      }
    } catch (error) {
      console.error('Kayıt hatası:', error)
      alert('Kayıt sırasında hata oluştu')
    }
  }

  const handleStartEdit = (item: any) => {
    setEditingItem(item.id)
    const startTime = new Date(item.startTime)
    const formattedTime = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}T${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
    
    setFormData({
      type: item.type,
      title: item.title,
      speakerName: item.speakerName || '',
      topic: item.topic || '',
      duration: item.duration,
      startTime: formattedTime,
      order: item.order,
      musicType: item.musicType || '',
      notes: item.notes || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Bu program öğesini silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const response = await fetch(`/api/program?id=${itemId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProgramItems(programItems.filter(item => item.id !== itemId))
      } else {
        const error = await response.json()
        alert(error.error || 'Silme başarısız')
      }
    } catch (error) {
      console.error('Silme hatası:', error)
      alert('Silme sırasında hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'SPEECH',
      title: '',
      speakerName: '',
      topic: '',
      duration: 10,
      startTime: '',
      order: programItems.length,
      musicType: '',
      notes: '',
    })
  }

  const getTypeInfo = (type: string) => {
    return programTypes.find(t => t.value === type) || programTypes[0]
  }

  const calculateEndTime = (startTime: string, duration: number) => {
    if (!startTime) return ''
    const start = new Date(startTime)
    const end = new Date(start.getTime() + duration * 60000)
    return end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Geri
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-xl text-white">
                  ⏱️
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Program Akışı</h1>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Yeni Program Öğesi
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-gray-500">Yükleniyor...</p>
        ) : programItems.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">Henüz program öğesi eklenmemiş</p>
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              İlk Öğeyi Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {programItems.map((item, index) => {
              const typeInfo = getTypeInfo(item.type)
              const startTime = new Date(item.startTime)
              const endTime = calculateEndTime(item.startTime, item.duration)
              
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-500">{typeInfo.label}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-gray-500">Başlangıç</p>
                          <p className="font-medium text-gray-900">
                            {startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Bitiş</p>
                          <p className="font-medium text-gray-900">{endTime}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Süre</p>
                          <p className="font-medium text-gray-900">{item.duration} dk</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Sıra</p>
                          <p className="font-medium text-gray-900">#{item.order + 1}</p>
                        </div>
                      </div>

                      {(item.speakerName || item.topic || item.musicType) && (
                        <div className="mt-4 space-y-1">
                          {item.speakerName && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">
                                {item.type === 'SPEECH' || item.type === 'HITABET' ? 'Konuşmacı' : 
                                 item.type === 'QURAN' ? 'Kuran Okuyan' : 
                                 item.type === 'EZAN' ? 'Ezan Okuyan' : 
                                 item.type === 'SUNUCU' ? 'Sunucu' : 
                                 'Konuşmacı/Kuran Okuyan/Ezan Okuyan'}
                                :
                              </span> {item.speakerName}
                            </p>
                          )}
                          {item.topic && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Konu:</span> {item.topic}
                            </p>
                          )}
                          {item.musicType && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Müzik Tipi:</span> {item.musicType}
                            </p>
                          )}
                        </div>
                      )}

                      {item.notes && (
                        <p className="mt-2 text-sm text-gray-500">{item.notes}</p>
                      )}
                    </div>
                    
                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                        title="Bearbeiten"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                        title="Löschen"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">
              {editingItem ? 'Program Öğesi Bearbeiten' : 'Yeni Program Öğesi Ekle'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Typ *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                >
                  {programTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Titel *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="z.B. Açılış Konuşması, İftar Başlangıcı, vb."
                />
              </div>

              {(formData.type === 'SPEECH' || formData.type === 'QURAN' || formData.type === 'EZAN' || formData.type === 'HITABET' || formData.type === 'SUNUCU') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.type === 'SPEECH' || formData.type === 'HITABET' ? 'Konuşmacı' : formData.type === 'QURAN' ? 'Kuran Okuyan' : formData.type === 'EZAN' ? 'Ezan Okuyan' : 'Sunucu'}
                    </label>
                    <input
                      type="text"
                      value={formData.speakerName}
                      onChange={(e) => setFormData({ ...formData, speakerName: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Name der Person"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Konu</label>
                    <input
                      type="text"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Thema/Konu"
                    />
                  </div>
                </>
              )}

              {formData.type === 'MUSIC' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Müzik Tipi</label>
                  <select
                    value={formData.musicType}
                    onChange={(e) => setFormData({ ...formData, musicType: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Müzik Tipi Seçin</option>
                    {musicTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Başlangıç Zeit *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dauer (Minuten) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Reihenfolge (Order) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="0, 1, 2, ..."
                />
                <p className="mt-1 text-xs text-gray-500">Programm wird nach dieser Nummer sortiert</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notlar</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Zusätzliche Notizen..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingItem ? 'Güncelle' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingItem(null)
                    resetForm()
                  }}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
