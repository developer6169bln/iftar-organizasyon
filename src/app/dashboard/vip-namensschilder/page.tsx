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
              onClick={handleGeneratePDF}
              disabled={generatingPDF || vipGuests.length === 0}
              className="ml-auto rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {generatingPDF ? '⏳ Generiere PDF...' : `📄 PDF generieren (${selectedGuests.length > 0 ? selectedGuests.length : 'Alle'} Gäste)`}
            </button>
          </div>
        </div>

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
