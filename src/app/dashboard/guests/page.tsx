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
  const [eventId, setEventId] = useState<string | null>(null)
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState({
    spreadsheetId: '',
    sheetName: 'Gästeliste',
    enabled: false,
    columnMapping: {} as Record<string, string>,
  })
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  
  // Verfügbare Datenbankfelder
  const dbFields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'E-Mail', required: false },
    { key: 'phone', label: 'Telefon', required: false },
    { key: 'title', label: 'Titel', required: false },
    { key: 'organization', label: 'Organisation', required: false },
    { key: 'tableNumber', label: 'Tischnummer', required: false },
    { key: 'isVip', label: 'VIP', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'needsSpecialReception', label: 'Benötigt Empfang', required: false },
    { key: 'receptionBy', label: 'Empfang von', required: false },
    { key: 'arrivalDate', label: 'Anreisedatum', required: false },
    { key: 'notes', label: 'Notizen', required: false },
  ]

  useEffect(() => {
    loadEventAndGuests()
    loadGoogleSheetsConfig()
  }, [])

  const loadEventAndGuests = async () => {
    try {
      const eventResponse = await fetch('/api/events')
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        setEventId(event.id)
      }
      await loadGuests()
    } catch (error) {
      console.error('Event yükleme hatası:', error)
      await loadGuests()
    }
  }

  const loadGoogleSheetsConfig = async () => {
    try {
      const eventResponse = await fetch('/api/events')
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        // Lade Konfiguration direkt von der Config-Route
        const configResponse = await fetch(`/api/google-sheets/config?eventId=${event.id}`)
        if (configResponse.ok) {
          const config = await configResponse.json()
          setGoogleSheetsConfig({
            spreadsheetId: config.spreadsheetId || '',
            sheetName: config.sheetName || 'Gästeliste',
            enabled: config.enabled || false,
            columnMapping: config.columnMapping || {},
          })
          
          // Lade auch Status für Sync-Informationen
          const statusResponse = await fetch(`/api/google-sheets/sync?eventId=${event.id}&action=status`)
          if (statusResponse.ok) {
            const status = await statusResponse.json()
            setSyncStatus(status)
            
            // Lade Sheet-Header wenn konfiguriert und verbunden
            if (config.spreadsheetId && status.connected) {
              setSheetHeaders(status.headers || [])
            }
          }
        } else {
          // Wenn keine Konfiguration vorhanden, setze Standardwerte
          setGoogleSheetsConfig({
            spreadsheetId: '',
            sheetName: 'Gästeliste',
            enabled: false,
            columnMapping: {},
          })
        }
      }
    } catch (error) {
      console.error('Google Sheets Config yükleme hatası:', error)
      // Setze Standardwerte bei Fehler
      setGoogleSheetsConfig({
        spreadsheetId: '',
        sheetName: 'Gästeliste',
        enabled: false,
        columnMapping: {},
      })
    }
  }

  const loadSheetHeaders = async () => {
    if (!eventId || !googleSheetsConfig.spreadsheetId) {
      alert('Bitte zuerst Spreadsheet ID eingeben')
      return
    }

    if (!googleSheetsConfig.sheetName || googleSheetsConfig.sheetName.trim() === '') {
      alert('Bitte zuerst Sheet-Name eingeben')
      return
    }

    try {
      // Verwende den Sheet-Namen aus dem Formular, nicht aus der DB
      const sheetName = encodeURIComponent(googleSheetsConfig.sheetName)
      const response = await fetch(`/api/google-sheets/sync?eventId=${eventId}&action=test&sheetName=${sheetName}`)
      const result = await response.json()
      
      if (response.ok) {
        if (result.error) {
          alert(`⚠️ Warnung: ${result.error}`)
        }
        
        if (result.headers && result.headers.length > 0) {
          setSheetHeaders(result.headers)
          
          // Auto-Mapping: Versuche automatisch Spalten zuzuordnen
          if (Object.keys(googleSheetsConfig.columnMapping).length === 0) {
            const autoMapping: Record<string, string> = {}
            const defaultMapping: Record<string, string> = {
              name: 'Name',
              email: 'E-Mail',
              phone: 'Telefon',
              title: 'Titel',
              organization: 'Organisation',
              tableNumber: 'Tischnummer',
              isVip: 'VIP',
              status: 'Status',
              needsSpecialReception: 'Benötigt Empfang',
              receptionBy: 'Empfang von',
              arrivalDate: 'Anreisedatum',
              notes: 'Notizen',
            }

            for (const [dbField, defaultColumn] of Object.entries(defaultMapping)) {
              // Suche nach exakter Übereinstimmung
              const exactMatch = result.headers.find((h: string) => h === defaultColumn)
              if (exactMatch) {
                autoMapping[dbField] = exactMatch
              } else {
                // Suche nach ähnlichen Namen (case-insensitive)
                const similarMatch = result.headers.find((h: string) => 
                  h.toLowerCase().includes(defaultColumn.toLowerCase()) ||
                  defaultColumn.toLowerCase().includes(h.toLowerCase())
                )
                if (similarMatch) {
                  autoMapping[dbField] = similarMatch
                }
              }
            }
            
            setGoogleSheetsConfig({ ...googleSheetsConfig, columnMapping: autoMapping })
          }
          
          if (!result.connected) {
            alert('⚠️ Verbindung fehlgeschlagen, aber Header konnten geladen werden. Prüfe die Berechtigungen.')
          }
        } else if (result.connected) {
          alert('⚠️ Verbindung erfolgreich, aber keine Header gefunden. Stelle sicher, dass das Sheet Daten enthält.')
        } else {
          alert(`❌ Verbindung fehlgeschlagen: ${result.error || 'Unbekannter Fehler'}`)
        }
      } else {
        alert(`❌ Fehler beim Laden: ${result.error || 'Unbekannter Fehler'}`)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Header:', error)
      alert(`❌ Fehler beim Laden der Header: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    }
  }

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
        await loadGuests()
        
        // Automatische Synchronisation zu Google Sheets (wenn aktiviert)
        if (googleSheetsConfig.enabled && eventId) {
          try {
            await syncToGoogleSheets()
          } catch (error) {
            console.error('Automatische Sync fehlgeschlagen:', error)
          }
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Misafir eklenirken hata oluştu')
      }
    } catch (error) {
      console.error('Misafir eklenirken hata:', error)
      alert('Misafir eklenirken hata oluştu')
    }
  }

  const syncToGoogleSheets = async () => {
    if (!eventId || !googleSheetsConfig.enabled) return

    try {
      setSyncing(true)
      const response = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          direction: 'to',
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setSyncStatus({ ...syncStatus, lastSync: result.lastSync })
        return true
      } else {
        const error = await response.json()
        console.error('Sync Fehler:', error)
        return false
      }
    } catch (error) {
      console.error('Sync Fehler:', error)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const syncFromGoogleSheets = async () => {
    if (!eventId || !googleSheetsConfig.enabled) return

    try {
      setSyncing(true)
      const response = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          direction: 'from',
        }),
      })

      if (response.ok) {
        const result = await response.json()
        await loadGuests()
        setSyncStatus({ ...syncStatus, lastSync: result.lastSync })
        alert(`Synchronisation abgeschlossen: ${result.created} erstellt, ${result.updated} aktualisiert`)
        return true
      } else {
        const error = await response.json()
        alert(error.error || 'Synchronisation fehlgeschlagen')
        return false
      }
    } catch (error) {
      console.error('Sync Fehler:', error)
      alert('Synchronisation fehlgeschlagen')
      return false
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveGoogleSheetsConfig = async () => {
    if (!eventId) return

    try {
      const response = await fetch('/api/google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          spreadsheetId: googleSheetsConfig.spreadsheetId,
          sheetName: googleSheetsConfig.sheetName,
          enabled: googleSheetsConfig.enabled,
          columnMapping: googleSheetsConfig.columnMapping,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        await loadGoogleSheetsConfig()
        setShowGoogleSheetsModal(false)
        
        if (result.warning) {
          alert(`Google Sheets Konfiguration gespeichert.\n\n⚠️ Warnung: ${result.warning}`)
        } else {
          alert('Google Sheets Konfiguration gespeichert')
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Konfiguration konnte nicht gespeichert werden')
      }
    } catch (error) {
      console.error('Config Fehler:', error)
      alert('Konfiguration konnte nicht gespeichert werden')
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
        await loadGuests()
        
        // Automatische Synchronisation zu Google Sheets (wenn aktiviert)
        if (googleSheetsConfig.enabled && eventId) {
          try {
            await syncToGoogleSheets()
          } catch (error) {
            console.error('Automatische Sync fehlgeschlagen:', error)
          }
        }
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

  const handleDelete = async (guestId: string) => {
    if (!confirm('Möchtest du diesen Gast wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return
    }

    try {
      const response = await fetch(`/api/guests?id=${guestId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Entferne Gast aus der Liste
        setGuests(guests.filter(g => g.id !== guestId))
        setFilteredGuests(filteredGuests.filter(g => g.id !== guestId))
        setEditingGuest(null)
        
        // Synchronisiere zu Google Sheets, falls aktiviert
        if (googleSheetsConfig.enabled && eventId) {
          try {
            await syncToGoogleSheets()
          } catch (syncError) {
            console.error('Sync nach Löschen fehlgeschlagen:', syncError)
          }
        }
        
        alert('Gast erfolgreich gelöscht')
      } else {
        const error = await response.json()
        alert(error.error || 'Gast konnte nicht gelöscht werden')
      }
    } catch (error) {
      console.error('Löschen Fehler:', error)
      alert('Fehler beim Löschen des Gastes')
    }
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
            <div className="flex gap-2">
              {googleSheetsConfig.enabled && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={syncToGoogleSheets}
                    disabled={syncing}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    title="Zu Google Sheets synchronisieren"
                  >
                    {syncing ? '⏳ Sync...' : '📤 Zu Sheets'}
                  </button>
                  <button
                    onClick={syncFromGoogleSheets}
                    disabled={syncing}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    title="Von Google Sheets synchronisieren"
                  >
                    {syncing ? '⏳ Sync...' : '📥 Von Sheets'}
                  </button>
                  {syncStatus?.lastSync && (
                    <span className="text-xs text-gray-500">
                      Letzte Sync: {new Date(syncStatus.lastSync).toLocaleString('de-DE')}
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowGoogleSheetsModal(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  googleSheetsConfig.enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Google Sheets Konfiguration"
              >
                📊 Google Sheets
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Yeni Misafir
              </button>
            </div>
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notizen</th>
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
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          {editingGuest === guest.id ? (
                            <textarea
                              defaultValue={guest.notes || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (guest.notes || '')) {
                                  handleUpdate(guest.id, { notes: e.target.value || null })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingGuest(null)
                                }
                              }}
                              rows={2}
                              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                              placeholder="Notizen eingeben..."
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-indigo-600 block truncate"
                              onClick={() => setEditingGuest(guest.id)}
                              title={guest.notes || 'Klicken zum Bearbeiten'}
                            >
                              {guest.notes || <span className="text-gray-400">-</span>}
                            </span>
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
                          <div className="flex items-center gap-2">
                            {editingGuest === guest.id ? (
                              <>
                                <button
                                  onClick={() => setEditingGuest(null)}
                                  className="text-sm text-indigo-600 hover:text-indigo-800"
                                  title="Bearbeitung beenden"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => handleDelete(guest.id)}
                                  className="text-sm text-red-600 hover:text-red-800"
                                  title="Gast löschen"
                                >
                                  🗑️
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditingGuest(guest.id)}
                                className="text-sm text-gray-600 hover:text-indigo-600"
                                title="Bearbeiten"
                              >
                                ✎
                              </button>
                            )}
                          </div>
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

        {/* Google Sheets Konfigurations-Modal */}
        {showGoogleSheetsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
            <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
              <h2 className="mb-4 text-xl font-semibold">Google Sheets Synchronisation</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Spreadsheet ID *
                  </label>
                    <p className="mb-1 text-xs text-gray-500">
                      Aus der Google Sheets URL: https://docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
                    </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={googleSheetsConfig.spreadsheetId}
                      onChange={(e) => setGoogleSheetsConfig({ ...googleSheetsConfig, spreadsheetId: e.target.value })}
                      className="mt-1 flex-1 rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="z.B. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    />
                    {googleSheetsConfig.spreadsheetId && (
                      <button
                        onClick={loadSheetHeaders}
                        className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Header laden
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sheet Name
                  </label>
                  <input
                    type="text"
                    value={googleSheetsConfig.sheetName}
                    onChange={(e) => setGoogleSheetsConfig({ ...googleSheetsConfig, sheetName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Gästeliste"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Name des Tabs im Spreadsheet (Standard: "Gästeliste")
                  </p>
                </div>

                {/* Spaltenzuordnung */}
                {sheetHeaders.length > 0 && (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Spaltenzuordnung</h3>
                      <button
                        onClick={() => setShowColumnMapping(!showColumnMapping)}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        {showColumnMapping ? 'Ausblenden' : 'Anzeigen'}
                      </button>
                    </div>
                    {showColumnMapping && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {dbFields.map((field) => (
                          <div key={field.key} className="flex items-center gap-2">
                            <label className="w-32 text-xs text-gray-600">
                              {field.label}
                              {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <select
                              value={googleSheetsConfig.columnMapping[field.key] || ''}
                              onChange={(e) => {
                                const newMapping = { ...googleSheetsConfig.columnMapping }
                                if (e.target.value) {
                                  newMapping[field.key] = e.target.value
                                } else {
                                  delete newMapping[field.key]
                                }
                                setGoogleSheetsConfig({ ...googleSheetsConfig, columnMapping: newMapping })
                              }}
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                            >
                              <option value="">-- Nicht zugeordnet --</option>
                              {sheetHeaders.map((header) => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                        <p className="mt-2 text-xs text-gray-500">
                          Ordne die Spalten aus deinem Google Sheet den Datenbankfeldern zu. 
                          Nicht zugeordnete Felder werden bei der Synchronisation ignoriert.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sheetsEnabled"
                    checked={googleSheetsConfig.enabled}
                    onChange={(e) => setGoogleSheetsConfig({ ...googleSheetsConfig, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="sheetsEnabled" className="text-sm font-medium text-gray-700">
                    Automatische Synchronisation aktivieren
                  </label>
                </div>

                {syncStatus && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="font-medium text-gray-700">Status:</p>
                    <p className="text-gray-600">
                      {syncStatus.configured ? '✅ Konfiguriert' : '❌ Nicht konfiguriert'}
                    </p>
                    {syncStatus.lastSync && (
                      <p className="text-gray-600">
                        Letzte Sync: {new Date(syncStatus.lastSync).toLocaleString('de-DE')}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-medium mb-1">📋 Setup-Anleitung:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Erstelle ein Google Sheet oder öffne ein bestehendes</li>
                    <li>Teile das Sheet mit der Service Account E-Mail (siehe .env)</li>
                    <li>Kopiere die Spreadsheet ID aus der URL</li>
                    <li>Füge die ID hier ein und klicke auf "Header laden"</li>
                    <li>Ordne die Spalten deines Sheets den Datenbankfeldern zu</li>
                    <li>Aktiviere die Synchronisation und speichere</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveGoogleSheetsConfig}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => {
                      setShowGoogleSheetsModal(false)
                      setShowColumnMapping(false)
                      loadGoogleSheetsConfig() // Reset auf gespeicherte Werte
                    }}
                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
