'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function VIPNamensschilderPage() {
  const router = useRouter()
  const [vipGuests, setVipGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [namensschildCount, setNamensschildCount] = useState<number>(4) // Standard: 4 pro A4
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSettings, setPreviewSettings] = useState({
    logoX: 10,
    logoY: 10,
    logoSize: 30,
    institutionX: 50,
    institutionY: 50,
    institutionSize: 10,
    institutionRotation: 0,
    nameX: 50,
    nameY: 70,
    nameSize: 14,
    nameRotation: 0,
  })
  const [draggingElement, setDraggingElement] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const checkAuth = () => {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('auth-token='))
        ?.split('=')[1] || localStorage.getItem('auth-token')

      if (!token || token.trim() === '') {
        router.push('/login')
        return
      }
    }

    checkAuth()
    loadVIPGuests()
  }, [router])

  useEffect(() => {
    // Global mouse event handlers für Drag & Drop
    if (draggingElement) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!draggingElement) return
        
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        
        setPreviewSettings(prev => {
          if (draggingElement === 'logo') {
            return { ...prev, logoX: Math.max(0, Math.min(prev.logoX + deltaX, 200 - prev.logoSize)), logoY: Math.max(0, Math.min(prev.logoY - deltaY, 100 - prev.logoSize)) }
          } else if (draggingElement === 'institution') {
            return { ...prev, institutionX: Math.max(0, Math.min(prev.institutionX + deltaX, 200)), institutionY: Math.max(0, Math.min(prev.institutionY - deltaY, 100)) }
          } else if (draggingElement === 'name') {
            return { ...prev, nameX: Math.max(0, Math.min(prev.nameX + deltaX, 200)), nameY: Math.max(0, Math.min(prev.nameY - deltaY, 100)) }
          }
          return prev
        })
        
        setDragStart({ x: e.clientX, y: e.clientY })
      }

      const handleGlobalMouseUp = () => {
        setDraggingElement(null)
      }

      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [draggingElement, dragStart])

  const loadVIPGuests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vip-guests')
      if (response.ok) {
        const data = await response.json()
        setVipGuests(data)
      } else {
        console.error('Fehler beim Laden der VIP-Gäste:', response.status)
      }
    } catch (error) {
      console.error('Fehler beim Laden der VIP-Gäste:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo-Datei ist zu groß. Bitte wählen Sie eine Datei unter 2MB.')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('Bitte wählen Sie eine Bilddatei (JPG, PNG, etc.)')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const getFieldValue = (guest: any, fieldName: string): string => {
    // Zuerst in additionalData suchen
    if (guest.additionalData) {
      try {
        const additional = JSON.parse(guest.additionalData)
        if (additional.hasOwnProperty(fieldName)) {
          const value = additional[fieldName]
          return value !== null && value !== undefined ? String(value) : ''
        }
      } catch (e) {
        console.error('Fehler beim Parsen von additionalData:', e)
      }
    }
    
    // Fallback zu Standard-Feldern
    if (fieldName === 'Vorname') {
      const nameParts = guest.name?.split(' ') || []
      return nameParts[0] || ''
    }
    if (fieldName === 'Name') {
      const nameParts = guest.name?.split(' ') || []
      return nameParts.slice(1).join(' ') || guest.name || ''
    }
    if (fieldName === 'Tisch-Nummer' || fieldName === 'Tischnummer') {
      return guest.tableNumber ? String(guest.tableNumber) : ''
    }
    if (fieldName === 'Staat/Institution' || fieldName === 'Staat / Institution') {
      // Zuerst in additionalData suchen
      if (guest.additionalData) {
        try {
          const additional = JSON.parse(guest.additionalData)
          // Prüfe verschiedene mögliche Feldnamen
          if (additional.hasOwnProperty('Staat/Institution')) {
            return String(additional['Staat/Institution'] || '')
          }
          if (additional.hasOwnProperty('Staat / Institution')) {
            return String(additional['Staat / Institution'] || '')
          }
          if (additional.hasOwnProperty('Staat/Institution')) {
            return String(additional['Staat/Institution'] || '')
          }
        } catch (e) {
          // Ignoriere Parse-Fehler
        }
      }
      return guest.organization || ''
    }
    
    return ''
  }

  const handleGeneratePDF = async () => {
    if (selectedGuests.length === 0 && !confirm('Keine Gäste ausgewählt. Möchten Sie PDFs für alle VIP-Gäste erstellen?')) {
      return
    }

    const guestsToGenerate = selectedGuests.length > 0 
      ? vipGuests.filter(g => selectedGuests.includes(g.id))
      : vipGuests

    if (guestsToGenerate.length === 0) {
      alert('Keine Gäste zum Generieren gefunden')
      return
    }

    setGeneratingPDF(true)
    try {
      const formData = new FormData()
      formData.append('guests', JSON.stringify(guestsToGenerate))
      formData.append('count', String(namensschildCount))
      formData.append('settings', JSON.stringify(previewSettings))
      if (logoFile) {
        formData.append('logo', logoFile)
      }

      const response = await fetch('/api/vip-namensschilder/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Generieren des PDFs')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `namensschilder-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      alert('✅ Namensschilder-PDF erfolgreich erstellt!')
    } catch (error) {
      console.error('Fehler beim Generieren des PDFs:', error)
      alert('Fehler: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleMouseDown = (element: string, e: React.MouseEvent) => {
    e.preventDefault()
    setDraggingElement(element)
    setDragStart({ x: e.clientX, y: e.clientY })
  }


  const handleRotationChange = (element: string, rotation: number) => {
    setPreviewSettings(prev => {
      if (element === 'institution') {
        return { ...prev, institutionRotation: rotation }
      } else if (element === 'name') {
        return { ...prev, nameRotation: rotation }
      }
      return prev
    })
  }

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    )
  }

  const selectAll = () => {
    setSelectedGuests(vipGuests.map(g => g.id))
  }

  const deselectAll = () => {
    setSelectedGuests([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">VIP Liste und Namensschilder</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Konfiguration */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">Namensschilder-Einstellungen</h2>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Anzahl Namensschilder pro A4-Seite *
              </label>
              <select
                value={namensschildCount}
                onChange={(e) => setNamensschildCount(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value={2}>2 Namensschilder</option>
                <option value={4}>4 Namensschilder</option>
                <option value={6}>6 Namensschilder</option>
                <option value={8}>8 Namensschilder</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Die Namensschilder werden gleichmäßig auf der A4-Seite verteilt und in der Mitte klappbar erstellt.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Logo hochladen (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {logoPreview && (
                <div className="mt-2">
                  <img 
                    src={logoPreview} 
                    alt="Logo Preview" 
                    className="h-16 w-auto rounded border border-gray-300"
                  />
                  <button
                    onClick={() => {
                      setLogoFile(null)
                      setLogoPreview(null)
                    }}
                    className="mt-1 text-xs text-red-600 hover:text-red-700"
                  >
                    Logo entfernen
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Max. 2MB, JPG/PNG empfohlen
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={selectAll}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Alle auswählen
            </button>
            <button
              onClick={deselectAll}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Auswahl aufheben
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              {showPreview ? '❌ Vorschau schließen' : '👁️ Vorschau öffnen'}
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={generatingPDF || vipGuests.length === 0}
              className="ml-auto rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {generatingPDF ? '⏳ Generiere PDF...' : `📄 PDF generieren (${selectedGuests.length > 0 ? selectedGuests.length : 'Alle'} Gäste)`}
            </button>
          </div>
        </div>

        {/* Vorschau */}
        {showPreview && vipGuests.length > 0 && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">Vorschau Namensschild</h2>
            <div className="mb-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
              <div 
                className="relative mx-auto bg-white shadow-lg"
                style={{ 
                  width: '200px', 
                  height: '100px',
                  border: '1px solid #ccc'
                }}
              >
                {/* Logo */}
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    style={{
                      position: 'absolute',
                      left: `${previewSettings.logoX}px`,
                      top: `${previewSettings.logoY}px`,
                      width: `${previewSettings.logoSize}px`,
                      height: `${previewSettings.logoSize}px`,
                      cursor: draggingElement === 'logo' ? 'grabbing' : 'grab',
                      border: draggingElement === 'logo' ? '2px solid blue' : '1px dashed gray',
                    }}
                    onMouseDown={(e) => handleMouseDown('logo', e)}
                    draggable={false}
                  />
                )}
                
                {/* Institution Text */}
                {vipGuests[0] && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${previewSettings.institutionX}px`,
                      top: `${previewSettings.institutionY}px`,
                      fontSize: `${previewSettings.institutionSize}px`,
                      transform: `rotate(${previewSettings.institutionRotation}deg)`,
                      cursor: draggingElement === 'institution' ? 'grabbing' : 'grab',
                      border: draggingElement === 'institution' ? '2px solid blue' : '1px dashed gray',
                      padding: '2px',
                      backgroundColor: draggingElement === 'institution' ? 'rgba(0,0,255,0.1)' : 'transparent',
                    }}
                    onMouseDown={(e) => handleMouseDown('institution', e)}
                  >
                    {getFieldValue(vipGuests[0], 'Staat/Institution') || getFieldValue(vipGuests[0], 'Staat / Institution') || 'Staat/Institution'}
                  </div>
                )}
                
                {/* Name Text */}
                {vipGuests[0] && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${previewSettings.nameX}px`,
                      top: `${previewSettings.nameY}px`,
                      fontSize: `${previewSettings.nameSize}px`,
                      fontWeight: 'bold',
                      transform: `rotate(${previewSettings.nameRotation}deg)`,
                      cursor: draggingElement === 'name' ? 'grabbing' : 'grab',
                      border: draggingElement === 'name' ? '2px solid blue' : '1px dashed gray',
                      padding: '2px',
                      backgroundColor: draggingElement === 'name' ? 'rgba(0,0,255,0.1)' : 'transparent',
                    }}
                    onMouseDown={(e) => handleMouseDown('name', e)}
                  >
                    {[getFieldValue(vipGuests[0], 'Vorname'), getFieldValue(vipGuests[0], 'Name')].filter(n => n).join(' ') || 'Vorname Name'}
                  </div>
                )}
              </div>
            </div>
            
            {/* Einstellungen */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Institution Schriftgröße</label>
                <input
                  type="number"
                  value={previewSettings.institutionSize}
                  onChange={(e) => setPreviewSettings({ ...previewSettings, institutionSize: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="8"
                  max="24"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Institution Rotation (°)</label>
                <input
                  type="number"
                  value={previewSettings.institutionRotation}
                  onChange={(e) => handleRotationChange('institution', Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="-180"
                  max="180"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name Schriftgröße</label>
                <input
                  type="number"
                  value={previewSettings.nameSize}
                  onChange={(e) => setPreviewSettings({ ...previewSettings, nameSize: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="8"
                  max="24"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name Rotation (°)</label>
                <input
                  type="number"
                  value={previewSettings.nameRotation}
                  onChange={(e) => handleRotationChange('name', Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="-180"
                  max="180"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Logo Größe</label>
                <input
                  type="number"
                  value={previewSettings.logoSize}
                  onChange={(e) => setPreviewSettings({ ...previewSettings, logoSize: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="10"
                  max="100"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              💡 Tipp: Ziehen Sie Logo und Texte per Drag & Drop an die gewünschte Position. Verwenden Sie die Rotation, um Texte zu drehen.
            </p>
          </div>
        )}

        {/* VIP-Gäste Liste */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              VIP-Gäste ({vipGuests.length})
            </h2>
            <div className="text-sm text-gray-600">
              {selectedGuests.length > 0 && `${selectedGuests.length} ausgewählt`}
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-500">Lade VIP-Gäste...</p>
          ) : vipGuests.length === 0 ? (
            <p className="text-center text-gray-500">Keine VIP-Gäste gefunden</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Auswahl
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Staat/Institution
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Anrede 1
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Anrede 2
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Anrede 3
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Anrede 4
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Vorname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Tisch-Nummer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {vipGuests.map((guest) => (
                    <tr key={guest.id} className={selectedGuests.includes(guest.id) ? 'bg-blue-50' : ''}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedGuests.includes(guest.id)}
                          onChange={() => toggleGuestSelection(guest.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Staat/Institution') || getFieldValue(guest, 'Staat / Institution') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Anrede 1') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Anrede 2') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Anrede 3') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Anrede 4') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Vorname') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Name') || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getFieldValue(guest, 'Tisch-Nummer') || getFieldValue(guest, 'Tischnummer') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
