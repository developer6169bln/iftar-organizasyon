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
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateIsDocx, setTemplateIsDocx] = useState(false)
  const [useDocxOutput, setUseDocxOutput] = useState(false)
  const [templateFields, setTemplateFields] = useState<Array<{ name: string; type: string }>>([])
  const [fieldMapping, setFieldMapping] = useState<{ [pdfFieldName: string]: string }>({})
  const [extractingFields, setExtractingFields] = useState(false)
  const [namensschildCount, setNamensschildCount] = useState<number>(4) // Standard: 4 pro A4
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [cardOrientation, setCardOrientation] = useState<'portrait' | 'landscape'>('portrait') // Hochformat (85x120) oder Querformat (120x85)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSettings, setPreviewSettings] = useState({
    logoX: 10,
    logoY: 10,
    logoWidth: 30,
    logoHeight: 30,
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
          const previewWidth = cardOrientation === 'landscape' ? 240 : 170
          const previewHeight = cardOrientation === 'landscape' ? 170 : 240
          
          if (draggingElement === 'logo') {
            return { ...prev, logoX: Math.max(0, Math.min(prev.logoX + deltaX, previewWidth - prev.logoWidth)), logoY: Math.max(0, Math.min(prev.logoY - deltaY, previewHeight - prev.logoHeight)) }
          } else if (draggingElement === 'institution') {
            return { ...prev, institutionX: Math.max(0, Math.min(prev.institutionX + deltaX, previewWidth)), institutionY: Math.max(0, Math.min(prev.institutionY - deltaY, previewHeight)) }
          } else if (draggingElement === 'name') {
            return { ...prev, nameX: Math.max(0, Math.min(prev.nameX + deltaX, previewWidth)), nameY: Math.max(0, Math.min(prev.nameY - deltaY, previewHeight)) }
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
      // Zuerst in additionalData suchen mit erweiterten Varianten
      if (guest.additionalData) {
        try {
          const additional = JSON.parse(guest.additionalData)
          
          // Erweiterte Suche nach verschiedenen Varianten
          const institutionKeys = [
            'Staat/Institution',
            'Staat / Institution',
            'Staat/Institution',
            'Staat /Institution',
            'Staat/ Institution',
            'StaatInstitution',
            'Staat_Institution',
            'Institution',
            'Staat',
            'Organisation',
            'Organization',
            'Partei / Organisation / Unternehmen',
            'Partei/Organisation/Unternehmen',
          ]
          
          for (const key of institutionKeys) {
            if (additional.hasOwnProperty(key)) {
              const value = additional[key]
              if (value !== null && value !== undefined && String(value).trim() !== '') {
                return String(value)
              }
            }
          }
          
          // Fallback: Suche nach Keys die "Staat" oder "Institution" enthalten
          for (const key of Object.keys(additional)) {
            const keyLower = key.toLowerCase()
            if ((keyLower.includes('staat') || keyLower.includes('institution') || 
                 keyLower.includes('organisation') || keyLower.includes('organization')) &&
                additional[key] !== null && additional[key] !== undefined) {
              const value = String(additional[key]).trim()
              if (value !== '') {
                return value
              }
            }
          }
        } catch (e) {
          console.error('Fehler beim Parsen von additionalData für Staat/Institution:', e)
        }
      }
      
      // Fallback zu guest.organization
      return guest.organization || ''
    }
    
    return ''
  }

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const fileName = file.name.toLowerCase()
      const isPdf =
        file.type === 'application/pdf' ||
        fileName.endsWith('.pdf')
      const isDocx =
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')

      if (!isPdf && !isDocx) {
        alert('Bitte laden Sie eine PDF- oder Word-Datei (DOCX) hoch')
        return
      }

      setTemplateFile(file)
      setTemplateIsDocx(isDocx)
      setUseDocxOutput(isDocx) // Standard: wenn DOCX, Ausgabe auch als DOCX vorschlagen
      setUseTemplate(true)
      setExtractingFields(true)
      setTemplateFields([])
      setFieldMapping({})
      
      try {
        // Extrahiere Felder / Platzhalter aus dem Template (PDF oder DOCX)
        const formData = new FormData()
        formData.append('template', file)
        
        const response = await fetch('/api/vip-namensschilder/extract-fields', {
          method: 'POST',
          body: formData,
        })
        
        const data = await response.json()
        
        if (data.fields && data.fields.length > 0) {
          setTemplateFields(data.fields)
          // Automatisches Mapping basierend auf Feldnamen
          const autoMapping: { [key: string]: string } = {}
          data.fields.forEach((field: { name: string; type: string }) => {
            const fieldNameUpper = field.name.toUpperCase()
            if (fieldNameUpper.includes('NAME') && !fieldNameUpper.includes('VOR')) {
              autoMapping[field.name] = 'Name'
            } else if (fieldNameUpper.includes('VORNAME') || fieldNameUpper.includes('VOR_NAME')) {
              autoMapping[field.name] = 'Vorname'
            } else if (fieldNameUpper.includes('TISCH') && fieldNameUpper.includes('NUMMER')) {
              autoMapping[field.name] = 'Tisch-Nummer'
            } else if (fieldNameUpper.includes('STAAT') || fieldNameUpper.includes('INSTITUTION')) {
              autoMapping[field.name] = 'Staat/Institution'
            }
          })
          setFieldMapping(autoMapping)
          const templateTypeLabel = isPdf ? 'Formularfeld(er) im PDF' : 'Platzhalter im DOCX ({{...}})'
          alert(`✅ ${data.fields.length} ${templateTypeLabel} gefunden. Bitte ordnen Sie die Felder zu.`)
        } else {
          if (isPdf) {
            alert('⚠️ Keine Formularfelder im PDF gefunden. Bitte erstellen Sie ein PDF mit Formularfeldern.')
          } else {
            alert('⚠️ Keine Platzhalter im DOCX gefunden. Bitte verwenden Sie z.B. {{NAME}}, {{VORNAME}}, {{STAAT_INSTITUTION}}.')
          }
        }
      } catch (error) {
        console.error('Fehler beim Extrahieren der Template-Felder:', error)
        alert('Fehler beim Extrahieren der Template-Felder: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      } finally {
        setExtractingFields(false)
      }
    }
  }

  const handleGeneratePDF = async () => {
    if (selectedGuests.length === 0 && !confirm('Keine Gäste ausgewählt. Möchten Sie PDFs für alle VIP-Gäste erstellen?')) {
      return
    }

    if (useTemplate && !templateFile) {
      alert('Bitte laden Sie ein Template (PDF oder DOCX) hoch')
      return
    }

    if (useTemplate && templateFields.length > 0) {
      const mappedFields = Object.values(fieldMapping).filter(v => v !== '')
      if (mappedFields.length === 0) {
        alert('Bitte ordnen Sie mindestens ein Template-Feld/Platzhalter einem Gast-Datenfeld zu.')
        return
      }
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
      formData.append('useTemplate', String(useTemplate))
      if (useTemplate && templateFile) {
        formData.append('template', templateFile)
        formData.append('fieldMapping', JSON.stringify(fieldMapping))
      } else {
        formData.append('count', String(namensschildCount))
        formData.append('settings', JSON.stringify(previewSettings))
        formData.append('orientation', cardOrientation)
        if (logoFile) {
          formData.append('logo', logoFile)
        }
      }
      // Entscheide, ob PDF oder DOCX generiert werden soll
      const isDocxTemplate =
        useTemplate &&
        templateFile &&
        (templateFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          templateFile.name.toLowerCase().endsWith('.docx'))

      const useDocx = Boolean(isDocxTemplate && useDocxOutput)

      if (useDocx) {
        formData.append('outputFormat', 'docx')
      } else {
        formData.append('outputFormat', 'pdf')
      }

      const endpoint = useDocx
        ? '/api/vip-namensschilder/generate-docx'
        : '/api/vip-namensschilder/generate'

      const response = await fetch(endpoint, {
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
      const ext = useDocx ? 'docx' : 'pdf'
      a.download = `namensschilder-${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      alert(useDocx ? '✅ Namensschilder-DOCX erfolgreich erstellt!' : '✅ Namensschilder-PDF erfolgreich erstellt!')
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
          
          {/* Template-Option */}
          <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="useTemplate"
                checked={useTemplate}
                onChange={(e) => {
                  setUseTemplate(e.target.checked)
                  if (!e.target.checked) {
                    setTemplateFile(null)
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="useTemplate" className="text-sm font-medium text-gray-700">
                Template verwenden (PDF mit Formularfeldern oder Word mit Platzhaltern, z.B. &#123;&#123;NAME&#125;&#125;)
              </label>
            </div>
            {useTemplate && (
              <div className="mt-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Template hochladen (PDF oder Word/DOCX) *
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleTemplateUpload}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {templateFile && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">✓ {templateFile.name}</span>
                      <button
                        onClick={() => {
                          setTemplateFile(null)
                          setUseTemplate(false)
                          setTemplateIsDocx(false)
                          setUseDocxOutput(false)
                          setTemplateFields([])
                          setFieldMapping({})
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Entfernen
                      </button>
                    </div>
                    {extractingFields && (
                      <p className="mt-1 text-xs text-blue-600">⏳ Extrahiere Formularfelder...</p>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Laden Sie ein PDF-Formular (mit Formularfeldern) oder ein Word-Dokument (DOCX) mit Platzhaltern wie &#123;&#123;NAME&#125;&#125; hoch. Die Felder/Platzhalter werden automatisch erkannt und können zugeordnet werden.
                </p>
                {templateFile && templateIsDocx && (
                  <div className="mt-3 rounded-md bg-white p-3 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        id="useDocxOutput"
                        type="checkbox"
                        checked={useDocxOutput}
                        onChange={(e) => setUseDocxOutput(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor="useDocxOutput" className="text-sm font-medium text-gray-700">
                        Diese DOCX-Vorlage als Ausgabeformat verwenden (statt PDF)?
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Wenn aktiviert, wird beim Generieren eine Word-Datei (.docx) erstellt, in der alle Platzhalter &#123;&#123;...&#125;&#125; mit den Gastdaten ersetzt werden.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Feld-Mapping */}
            {templateFields.length > 0 && (
              <div className="mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Feld-Zuordnung</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Ordnen Sie jedes PDF-Formularfeld einem Gast-Datenfeld zu:
                </p>
                <div className="space-y-3">
                  {templateFields.map((field) => (
                    <div key={field.name} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">
                          PDF-Feld: <span className="font-mono text-blue-600">{field.name}</span>
                        </label>
                        <span className="text-xs text-gray-500">Typ: {field.type}</span>
                      </div>
                      <div className="flex-1">
                        <select
                          value={fieldMapping[field.name] || ''}
                          onChange={(e) => {
                            setFieldMapping(prev => ({
                              ...prev,
                              [field.name]: e.target.value
                            }))
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">-- Nicht zuordnen --</option>
                          <option value="Name">Name (Vollständiger Name)</option>
                          <option value="Vorname">Vorname</option>
                          <option value="Tisch-Nummer">Tisch-Nummer</option>
                          <option value="Staat/Institution">Staat/Institution</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-yellow-50 p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Hinweis:</strong> Nur zugeordnete Felder werden beim Generieren des PDFs ausgefüllt.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {!useTemplate && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                Die Namensschilder werden gleichmäßig auf der A4-Seite verteilt. Karten-Größe: 85mm x 120mm.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Karten-Ausrichtung *
              </label>
              <select
                value={cardOrientation}
                onChange={(e) => setCardOrientation(e.target.value as 'portrait' | 'landscape')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="portrait">Hochformat (85mm x 120mm)</option>
                <option value="landscape">Querformat (120mm x 85mm)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Karten-Größe: 85mm x 120mm (Breite x Länge)
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
          )}

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
                  width: cardOrientation === 'landscape' ? '240px' : '170px', 
                  height: cardOrientation === 'landscape' ? '170px' : '240px',
                  border: '1px solid #ccc',
                  aspectRatio: cardOrientation === 'landscape' ? '120/85' : '85/120'
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
                      width: `${previewSettings.logoWidth}px`,
                      height: `${previewSettings.logoHeight}px`,
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Logo Breite (px)</label>
                <input
                  type="number"
                  value={previewSettings.logoWidth}
                  onChange={(e) => setPreviewSettings({ ...previewSettings, logoWidth: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="10"
                  max="200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Logo Höhe (px)</label>
                <input
                  type="number"
                  value={previewSettings.logoHeight}
                  onChange={(e) => setPreviewSettings({ ...previewSettings, logoHeight: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  min="10"
                  max="200"
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
