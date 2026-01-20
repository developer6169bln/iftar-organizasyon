'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function GuestsPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<any[]>([])
  const [filteredGuests, setFilteredGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    organization: '',
    tableNumber: '',
    isVip: false,
    needsSpecialReception: false,
    receptionBy: '',
    arrivalDate: '',
    notes: '',
  })

  useEffect(() => {
    loadGuests()
  }, [])

  useEffect(() => {
    // Filter guests based on search query
    if (searchQuery.trim() === '') {
      setFilteredGuests(guests)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredGuests(
        guests.filter(guest =>
          guest.name.toLowerCase().includes(query) ||
          guest.email?.toLowerCase().includes(query) ||
          guest.title?.toLowerCase().includes(query) ||
          guest.organization?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, guests])

  const loadGuests = async () => {
    try {
      const response = await fetch('/api/guests')
      if (response.ok) {
        const data = await response.json()
        setGuests(data)
        setFilteredGuests(data)
      }
    } catch (error) {
      console.error('Misafirler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const eventResponse = await fetch('/api/events')
      if (!eventResponse.ok) {
        alert('Event yüklenirken hata oluştu')
        return
      }
      const event = await eventResponse.json()

      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          title: formData.title || undefined,
          organization: formData.organization || undefined,
          tableNumber: formData.tableNumber ? parseInt(formData.tableNumber) : undefined,
          isVip: formData.isVip,
          needsSpecialReception: formData.needsSpecialReception,
          receptionBy: formData.receptionBy || undefined,
          arrivalDate: formData.arrivalDate || undefined,
          notes: formData.notes || undefined,
        }),
      })

      if (response.ok) {
        setShowAddForm(false)
        setFormData({
          name: '',
          email: '',
          phone: '',
          title: '',
          organization: '',
          tableNumber: '',
          isVip: false,
          needsSpecialReception: false,
          receptionBy: '',
          arrivalDate: '',
          notes: '',
        })
        loadGuests()
      } else {
        const error = await response.json()
        alert(error.error || 'Misafir eklenirken hata oluştu')
      }
    } catch (error) {
      console.error('Misafir eklenirken hata:', error)
      alert('Misafir eklenirken hata oluştu')
    }
  }

  const handleUpdate = async (guestId: string, updatedData: any) => {
    try {
      // Daten für Update vorbereiten
      const updatePayload: any = { id: guestId }
      
      if (updatedData.name !== undefined) updatePayload.name = updatedData.name
      if (updatedData.email !== undefined) updatePayload.email = updatedData.email || null
      if (updatedData.phone !== undefined) updatePayload.phone = updatedData.phone || null
      if (updatedData.title !== undefined) updatePayload.title = updatedData.title || null
      if (updatedData.organization !== undefined) updatePayload.organization = updatedData.organization || null
      if (updatedData.tableNumber !== undefined) {
        updatePayload.tableNumber = updatedData.tableNumber ? parseInt(updatedData.tableNumber) : null
      }
      if (updatedData.isVip !== undefined) updatePayload.isVip = Boolean(updatedData.isVip)
      if (updatedData.needsSpecialReception !== undefined) updatePayload.needsSpecialReception = Boolean(updatedData.needsSpecialReception)
      if (updatedData.receptionBy !== undefined) updatePayload.receptionBy = updatedData.receptionBy || null
      if (updatedData.arrivalDate !== undefined) updatePayload.arrivalDate = updatedData.arrivalDate || null
      if (updatedData.status !== undefined) updatePayload.status = updatedData.status
      if (updatedData.notes !== undefined) updatePayload.notes = updatedData.notes || null

      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        setEditingGuest(null)
        loadGuests()
      } else {
        const error = await response.json()
        alert(error.error || error.details || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      alert('Güncelleme sırasında hata oluştu')
    }
  }

  const handleToggleVip = async (guestId: string, currentVip: boolean) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          isVip: !currentVip,
        }),
      })

      if (response.ok) {
        loadGuests()
      } else {
        const error = await response.json()
        alert(error.error || error.details || 'VIP durumu güncellenemedi')
      }
    } catch (error) {
      console.error('VIP toggle hatası:', error)
      alert('VIP durumu güncellenirken hata oluştu')
    }
  }

  const handleStatusChange = async (guestId: string, newStatus: string) => {
    await handleUpdate(guestId, { status: newStatus })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800'
      case 'ATTENDED':
        return 'bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'INVITED':
        return 'Davet Edildi'
      case 'CONFIRMED':
        return 'Onaylandı'
      case 'ATTENDED':
        return 'Katıldı'
      case 'CANCELLED':
        return 'İptal Edildi'
      case 'NO_SHOW':
        return 'Gelmedi'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-2xl font-bold text-gray-900">Misafir Yönetimi</h1>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Yeni Misafir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {showAddForm && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">Yeni Misafir Ekle</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">İsim *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">E-posta</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ünvan</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kurum</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Masa Numarası</label>
                <input
                  type="number"
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isVip}
                    onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">VIP Misafir</span>
                </label>
              </div>
              <div className="md:col-span-2 border-t border-gray-200 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Empfang & Anreise</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.needsSpecialReception}
                        onChange={(e) => setFormData({ ...formData, needsSpecialReception: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Besonderer Empfang erforderlich</span>
                    </label>
                  </div>
                  {formData.needsSpecialReception && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Empfangen von</label>
                        <input
                          type="text"
                          value={formData.receptionBy}
                          onChange={(e) => setFormData({ ...formData, receptionBy: e.target.value })}
                          placeholder="Name der Person, die empfängt"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Anreisedatum & Uhrzeit</label>
                        <input
                          type="datetime-local"
                          value={formData.arrivalDate}
                          onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notlar</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-xl bg-white shadow-md">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Misafir Listesi</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="İsim, e-posta, ünvan veya kurum ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Temizle
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <p className="text-gray-500">Yükleniyor...</p>
            ) : filteredGuests.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">
                  {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz misafir eklenmemiş'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">VIP</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">İsim</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Ünvan</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Kurum</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">E-posta</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Telefon</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Masa</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Empfang</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Anreise & Uhrzeit</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Durum</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.map((guest) => (
                      <tr
                        key={guest.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${guest.isVip ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleVip(guest.id, guest.isVip || false)}
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              guest.isVip
                                ? 'bg-yellow-400 text-yellow-900'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                            title={guest.isVip ? 'VIP' : 'VIP Yap'}
                          >
                            {guest.isVip ? '★' : '☆'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              defaultValue={guest.name}
                              onBlur={(e) => {
                                if (e.target.value !== guest.name) {
                                  handleUpdate(guest.id, { name: e.target.value })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                                if (e.key === 'Escape') {
                                  setEditingGuest(null)
                                }
                              }}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer font-medium text-gray-900 hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              defaultValue={guest.title || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (guest.title || '')) {
                                  handleUpdate(guest.id, { title: e.target.value || null })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingGuest(null)
                              }}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.title || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {editingGuest === guest.id ? (
                            <input
                              type="text"
                              defaultValue={guest.organization || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (guest.organization || '')) {
                                  handleUpdate(guest.id, { organization: e.target.value || null })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingGuest(null)
                              }}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.organization || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {editingGuest === guest.id ? (
                            <input
                              type="email"
                              defaultValue={guest.email || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (guest.email || '')) {
                                  handleUpdate(guest.id, { email: e.target.value || null })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingGuest(null)
                              }}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.email || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {editingGuest === guest.id ? (
                            <input
                              type="tel"
                              defaultValue={guest.phone || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (guest.phone || '')) {
                                  handleUpdate(guest.id, { phone: e.target.value || null })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingGuest(null)
                              }}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.phone || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {editingGuest === guest.id ? (
                            <input
                              type="number"
                              defaultValue={guest.tableNumber || ''}
                              onBlur={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : null
                                if (value !== guest.tableNumber) {
                                  handleUpdate(guest.id, { tableNumber: value })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingGuest(null)
                              }}
                              className="w-20 rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600"
                              onClick={() => setEditingGuest(guest.id)}
                            >
                              {guest.tableNumber || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {guest.needsSpecialReception ? (
                            <div className="flex flex-col gap-1">
                              <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                                ✓ Empfang
                              </span>
                              {guest.receptionBy && (
                                <span className="text-xs text-gray-600">von: {guest.receptionBy}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {guest.arrivalDate ? (
                            <span>
                              {new Date(guest.arrivalDate).toLocaleDateString('de-DE')} {new Date(guest.arrivalDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={guest.status}
                            onChange={(e) => handleStatusChange(guest.id, e.target.value)}
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(guest.status)} border-0 focus:ring-2 focus:ring-indigo-500`}
                          >
                            <option value="INVITED">Davet Edildi</option>
                            <option value="CONFIRMED">Onaylandı</option>
                            <option value="ATTENDED">Katıldı</option>
                            <option value="CANCELLED">İptal Edildi</option>
                            <option value="NO_SHOW">Gelmedi</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {editingGuest === guest.id ? (
                            <button
                              onClick={() => setEditingGuest(null)}
                              className="text-sm text-indigo-600 hover:text-indigo-800"
                            >
                              ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingGuest(guest.id)}
                              className="text-sm text-gray-600 hover:text-indigo-600"
                            >
                              ✎
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {searchQuery && (
              <div className="mt-4 text-sm text-gray-600">
                {filteredGuests.length} misafir bulundu (toplam {guests.length})
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
