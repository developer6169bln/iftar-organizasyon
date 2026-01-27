import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFImage, degrees, PDFPage, PDFFont, TextAlignment } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 60

// A4-Dimensionen in Punkten (1 Punkt = 1/72 Zoll)
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

// Karten-Dimensionen in mm, dann in Punkte umrechnen (1mm = 2.83465 Punkte)
const CARD_WIDTH_MM = 85  // Breite
const CARD_HEIGHT_MM = 120 // Länge
const MM_TO_POINTS = 2.83465
const CARD_WIDTH_POINTS = CARD_WIDTH_MM * MM_TO_POINTS  // ~240.95 Punkte
const CARD_HEIGHT_POINTS = CARD_HEIGHT_MM * MM_TO_POINTS // ~340.16 Punkte

// Hilfsfunktion: Hole Feldwert aus Guest
function getFieldValue(guest: any, fieldName: string): string {
  // Zuerst in additionalData suchen (verschiedene Varianten)
  if (guest.additionalData) {
    try {
      const additional = JSON.parse(guest.additionalData)
      
      // Suche nach verschiedenen Varianten des Feldnamens
      const fieldVariants = [
        fieldName,
        fieldName.replace('/', ' / '),
        fieldName.replace(' / ', '/'),
        fieldName.replace('/', ' /'),
        fieldName.replace(' /', '/'),
      ]
      
      for (const variant of fieldVariants) {
        if (additional.hasOwnProperty(variant)) {
          const value = additional[variant]
          if (value !== null && value !== undefined && String(value).trim() !== '') {
            console.log(`✅ Gefunden "${variant}":`, value)
            return String(value)
          }
        }
      }
      
      // Debug: Zeige alle Keys wenn "Staat" oder "Institution" gesucht wird
      if (fieldName.includes('Staat') || fieldName.includes('Institution')) {
        console.log('🔍 Suche nach Staat/Institution. Verfügbare Keys:', Object.keys(additional))
        console.log('🔍 Guest additionalData:', JSON.stringify(additional, null, 2))
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
    const orgValue = guest.organization || ''
    if (orgValue) {
      console.log('✅ Gefunden in guest.organization:', orgValue)
      return orgValue
    }
  }
  
  console.log(`⚠️ Feld "${fieldName}" nicht gefunden für Gast:`, guest.name || guest.id)
  return ''
}

// Erstelle ein Namensschild auf einer vorhandenen Seite
async function drawNamensschild(
  page: any,
  guest: any,
  x: number,
  y: number,
  width: number,
  height: number,
  logoImage: PDFImage | undefined,
  helveticaFont: any,
  helveticaBoldFont: any,
  settings: any,
  cardOrientation: 'portrait' | 'landscape'
) {
  // Hintergrund-Rahmen (keine Faltlinie mehr)
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1), // Weiß
  })

  // Hilfsfunktion: Sanitize Text für PDF
  const sanitizeText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
  }

  // Koordinaten-Transformation: Vorschau (HTML/CSS) zu PDF
  // Vorschau: top/left in Pixeln (170x240 Portrait oder 240x170 Landscape)
  // PDF: x/y in Punkten (240.95x340.16 Portrait oder 340.16x240.95 Landscape)
  // HTML: Y von oben (top=0 ist oben), PDF: Y von unten (y=0 ist unten)
  const previewWidth = cardOrientation === 'landscape' ? 240 : 170
  const previewHeight = cardOrientation === 'landscape' ? 170 : 240
  const scaleX = width / previewWidth
  const scaleY = height / previewHeight

  // Hilfsfunktion: Konvertiere Vorschau-Koordinaten zu PDF-Koordinaten
  const convertX = (previewX: number) => x + (previewX * scaleX)
  const convertY = (previewY: number) => {
    // Y umkehren: HTML top -> PDF y (von unten)
    // In HTML: top=0 ist oben, top=previewHeight ist unten
    // In PDF: y=0 ist unten (y der Karte), y=height ist oben
    // previewY ist der Abstand von oben in der Vorschau
    // Um zu PDF zu konvertieren: y + height - (previewY * scaleY)
    // Das gibt den Y-Wert von unten gemessen
    return y + height - (previewY * scaleY)
  }

  // Logo (wenn vorhanden) - verwende Einstellungen aus Vorschau
  if (logoImage) {
    const logoWidth = (settings?.logoWidth || 30) * scaleX
    const logoHeight = (settings?.logoHeight || 30) * scaleY
    // Logo-Position: top-left corner in Vorschau
    const logoX = convertX(settings?.logoX || 10)
    // Logo-Y: top position in Vorschau, für PDF brauchen wir bottom-left corner
    // convertY gibt die Y-Position von unten, also müssen wir die Höhe abziehen
    const logoY = convertY((settings?.logoY || 10) + (settings?.logoHeight || 30)) - logoHeight
    
    try {
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      })
    } catch (e) {
      console.error('Fehler beim Zeichnen des Logos:', e)
    }
  }

  // Nur: Staat/Institution, Vorname, Name
  
  // Staat/Institution - suche in verschiedenen Varianten
  let institution = getFieldValue(guest, 'Staat/Institution')
  if (!institution || institution.trim() === '') {
    institution = getFieldValue(guest, 'Staat / Institution')
  }
  if (!institution || institution.trim() === '') {
    // Versuche auch andere Varianten
    institution = getFieldValue(guest, 'Staat/Institution') || 
                  getFieldValue(guest, 'Staat / Institution') ||
                  getFieldValue(guest, 'Staat/ Institution') ||
                  getFieldValue(guest, 'Staat /Institution') || ''
  }
  
  console.log(`📋 Gast: ${guest.name || guest.id}, Institution: "${institution}"`)

  // Name
  const vorname = getFieldValue(guest, 'Vorname')
  const nachname = getFieldValue(guest, 'Name')
  const fullName = [vorname, nachname].filter(n => n && n.trim() !== '').join(' ')

  // Institution Text (mit Rotation)
  if (institution && institution.trim()) {
    try {
      const sanitizedInst = sanitizeText(institution)
      if (sanitizedInst) {
        const instSize = (settings?.institutionSize || 10) * scaleY
        const instX = convertX(settings?.institutionX || 50)
        const instY = convertY(settings?.institutionY || 50)
        const rotation = settings?.institutionRotation || 0
        
        console.log(`📝 Zeichne Institution: "${sanitizedInst}" bei (${instX}, ${instY}), Größe: ${instSize}, Rotation: ${rotation}`)
        
        page.drawText(sanitizedInst, {
          x: instX,
          y: instY,
          size: instSize,
          color: rgb(0, 0, 0),
          font: helveticaFont,
          rotate: rotation !== 0 ? degrees(rotation) : undefined,
        })
      } else {
        console.log(`⚠️ Institution-Text wurde nach Sanitize leer: "${institution}"`)
      }
    } catch (e) {
      console.error('Fehler beim Zeichnen der Institution:', e)
    }
  } else {
    console.log(`⚠️ Keine Institution gefunden für Gast: ${guest.name || guest.id}`)
  }

  // Name Text (mit Rotation)
  if (fullName && fullName.trim()) {
    try {
      const sanitizedName = sanitizeText(fullName)
      if (sanitizedName) {
        const nameSize = (settings?.nameSize || 14) * scaleY
        const nameX = convertX(settings?.nameX || 50)
        const nameY = convertY(settings?.nameY || 70)
        const rotation = settings?.nameRotation || 0
        
        page.drawText(sanitizedName, {
          x: nameX,
          y: nameY,
          size: nameSize,
          color: rgb(0, 0, 0),
          font: helveticaBoldFont,
          rotate: rotation !== 0 ? degrees(rotation) : undefined,
        })
      }
    } catch (e) {
      console.error('Fehler beim Zeichnen des Namens:', e)
    }
  }
}

// Hilfsfunktion: Fülle PDF-Template mit mehreren Gästen (wenn mehrere Felder mit gleichem Namen)
async function fillTemplateWithMultipleGuests(
  templateBytes: ArrayBuffer,
  guests: any[],
  getFieldValue: (guest: any, fieldName: string) => string,
  fieldMapping: { [pdfFieldName: string]: string }
): Promise<PDFDocument> {
  // Lade Template
  const filledDoc = await PDFDocument.load(templateBytes)
  
  // Versuche PDF-Formularfelder zu füllen
  let form: any = null
  try {
    form = filledDoc.getForm()
    const fields = form.getFields()
    
    console.log(`🔍 Gefundene Formularfelder: ${fields.length}`)
    console.log(`📋 Mapping:`, JSON.stringify(fieldMapping, null, 2))
    console.log(`👥 Gäste: ${guests.length}`)
    
    // Gruppiere Felder nach Basisnamen (ohne Nummer am Ende)
    // z.B. "Name1", "Name2", "Name3" → Basisname "Name"
    const fieldsByBaseName: { [baseName: string]: { fields: any[], indices: number[] } } = {}
    
    for (const field of fields) {
      const pdfFieldName = field.getName()
      
      // Prüfe ob Feldname mit Nummer endet (1-9)
      const numberMatch = pdfFieldName.match(/^(.+?)([1-9])$/)
      
      if (numberMatch) {
        // Feld hat Nummer am Ende (z.B. "Name1", "Vorname2")
        const baseName = numberMatch[1] // z.B. "Name"
        const fieldIndex = parseInt(numberMatch[2]) - 1 // 0-basiert (1→0, 2→1, etc.)
        
        if (!fieldsByBaseName[baseName]) {
          fieldsByBaseName[baseName] = { fields: [], indices: [] }
        }
        fieldsByBaseName[baseName].fields.push(field)
        fieldsByBaseName[baseName].indices.push(fieldIndex)
        
        console.log(`  📋 Feld "${pdfFieldName}" → Basisname "${baseName}", Index ${fieldIndex}`)
      } else {
        // Feld hat keine Nummer, behandle als einzelnes Feld
        if (!fieldsByBaseName[pdfFieldName]) {
          fieldsByBaseName[pdfFieldName] = { fields: [], indices: [] }
        }
        fieldsByBaseName[pdfFieldName].fields.push(field)
        fieldsByBaseName[pdfFieldName].indices.push(0) // Standard-Index 0
      }
    }
    
    console.log(`📊 Feld-Gruppierung: ${Object.keys(fieldsByBaseName).length} verschiedene Basisnamen`)
    for (const [baseName, data] of Object.entries(fieldsByBaseName)) {
      console.log(`  - "${baseName}": ${data.fields.length} Feld(er), Indizes: [${data.indices.join(', ')}]`)
    }
    
    // Bestimme maximale Anzahl Gäste pro Seite basierend auf höchstem Index
    let maxGuestsPerPage = 1
    for (const [baseName, data] of Object.entries(fieldsByBaseName)) {
      // Prüfe ob dieser Basisname zugeordnet ist
      if (fieldMapping[baseName] || data.fields.some(f => fieldMapping[f.getName()])) {
        const maxIndex = Math.max(...data.indices, 0)
        maxGuestsPerPage = Math.max(maxGuestsPerPage, maxIndex + 1) // +1 weil 0-basiert
      }
    }
    
    console.log(`📊 Maximale Gäste pro Seite (basierend auf Feld-Indizes): ${maxGuestsPerPage}`)
    
    let filledCount = 0
    
    // Für jedes Feld-Gruppe: Fülle mit entsprechendem Gast
    for (const [baseName, data] of Object.entries(fieldsByBaseName)) {
      const { fields: fieldList, indices } = data
      
      // Finde zugeordnetes Gast-Feld (prüfe Basisname und einzelne Felder)
      let guestFieldName = fieldMapping[baseName]
      if (!guestFieldName) {
        // Prüfe ob einzelne Felder zugeordnet sind (z.B. "Name1", "Name2")
        for (const field of fieldList) {
          const fieldName = field.getName()
          if (fieldMapping[fieldName]) {
            guestFieldName = fieldMapping[fieldName]
            console.log(`  📋 Basisname "${baseName}" zugeordnet über Feld "${fieldName}" → "${guestFieldName}"`)
            break
          }
        }
      }
      
      console.log(`\n🔍 Verarbeite Feld-Gruppe: "${baseName}" (${fieldList.length} Feld(er))`)
      
      if (!guestFieldName || guestFieldName === '') {
        console.log(`  ⏭️ Nicht zugeordnet, überspringe`)
        continue
      }
      
      console.log(`  📋 Zugeordnet zu Gast-Feld: "${guestFieldName}"`)
      
      // Fülle jedes Feld in der Gruppe mit dem entsprechenden Gast basierend auf Index
      const filledGuestsInGroup = new Set<string>()
      
      for (let i = 0; i < fieldList.length; i++) {
        const field = fieldList[i]
        const fieldIndex = indices[i] // Index aus Feldname (0-basiert: 0, 1, 2, 3)
        const guest = guests[fieldIndex] // Nimm den Gast am entsprechenden Index
        
        if (!guest) {
          console.log(`  ⏭️ Kein Gast für Index ${fieldIndex} (Feld ${i + 1}/${fieldList.length}), überspringe`)
          continue
        }
        
        const guestId = guest.id || guest.name || JSON.stringify(guest)
        
        // Prüfe ob dieser Gast bereits in dieser Gruppe verarbeitet wurde
        if (filledGuestsInGroup.has(guestId)) {
          console.warn(`  ⚠️ Gast ${guest.name || guest.id} wurde bereits in dieser Gruppe verarbeitet, überspringe Duplikat`)
          continue
        }
        
        filledGuestsInGroup.add(guestId)
        console.log(`  👤 Fülle Feld ${i + 1}/${fieldList.length} (Index ${fieldIndex}) mit Gast: ${guest.name || guest.id}`)
        
        // Hole Wert aus Gast-Daten
        let value = getFieldValue(guest, guestFieldName)
        console.log(`  📊 Wert vor Verarbeitung: "${value}"`)
        
        // Spezielle Behandlung für "Name" (Vollständiger Name)
        if (guestFieldName === 'Name') {
          const vorname = getFieldValue(guest, 'Vorname')
          const nachname = getFieldValue(guest, 'Name')
          value = [vorname, nachname].filter(n => n && n.trim() !== '').join(' ')
          console.log(`  🔄 Name zusammengesetzt: Vorname="${vorname}", Nachname="${nachname}" → "${value}"`)
        }
        
        if (!value || value.trim() === '') {
          console.log(`  ⚠️ Kein Wert gefunden, überspringe`)
          continue
        }
        
        try {
          const fieldType = field.constructor.name
          console.log(`  📝 Feld-Typ: ${fieldType}`)
          console.log(`  ✏️ Setze Wert: "${value}"`)
          
          // Versuche verschiedene Methoden, um das Feld zu setzen
          const fieldAny = field as any
          
          if (fieldType === 'PDFTextField') {
            fieldAny.setText(value)
            // Zentriere den Text
            try {
              if (typeof fieldAny.setAlignment === 'function') {
                fieldAny.setAlignment(TextAlignment.Center)
                console.log(`  ✅ TextField zentriert`)
              }
            } catch (alignError) {
              console.warn(`  ⚠️ Konnte Text nicht zentrieren:`, alignError)
            }
            const currentValue = fieldAny.getText()
            console.log(`  ✅ TextField gesetzt. Aktueller Wert: "${currentValue}"`)
            filledCount++
          } else if (fieldType === 'PDFCheckBox') {
            const checkBox = field as any
            const boolValue = value.toLowerCase() === 'true' || value.toLowerCase() === 'ja' || value === '1'
            if (boolValue) {
              checkBox.check()
              console.log(`  ✅ CheckBox aktiviert`)
            } else {
              checkBox.uncheck()
              console.log(`  ✅ CheckBox deaktiviert`)
            }
            filledCount++
          } else if (fieldType === 'PDFDropdown') {
            const dropdown = field as any
            try {
              dropdown.select(value)
              console.log(`  ✅ Dropdown ausgewählt: "${value}"`)
              filledCount++
            } catch (e) {
              console.warn(`  ⚠️ Wert "${value}" nicht in Dropdown-Liste:`, e)
            // Versuche als Text zu setzen, falls möglich
            if (typeof dropdown.setText === 'function') {
              dropdown.setText(value)
              // Zentriere den Text
              try {
                if (typeof dropdown.setAlignment === 'function') {
                  dropdown.setAlignment(TextAlignment.Center)
                  console.log(`  ✅ Dropdown-Text zentriert`)
                }
              } catch (alignError) {
                console.warn(`  ⚠️ Konnte Dropdown-Text nicht zentrieren:`, alignError)
              }
              console.log(`  ✅ Dropdown als Text gesetzt: "${value}"`)
              filledCount++
            }
            }
          } else if (fieldType === 'PDFRadioGroup') {
            const radioGroup = field as any
            try {
              radioGroup.select(value)
              console.log(`  ✅ Radio-Button ausgewählt: "${value}"`)
              filledCount++
            } catch (e) {
              console.warn(`  ⚠️ Konnte Radio-Button nicht setzen:`, e)
            }
          } else {
            console.warn(`  ⚠️ Unbekannter Feld-Typ: ${fieldType}, versuche generische Methoden`)
            // Versuche generische Methoden
            if (typeof fieldAny.setText === 'function') {
              try {
                fieldAny.setText(value)
                // Zentriere den Text
                try {
                  if (typeof fieldAny.setAlignment === 'function') {
                    fieldAny.setAlignment(TextAlignment.Center)
                    console.log(`  ✅ Feld-Text zentriert`)
                  }
                } catch (alignError) {
                  console.warn(`  ⚠️ Konnte Text nicht zentrieren:`, alignError)
                }
                console.log(`  ✅ Feld mit setText() gesetzt: "${value}"`)
                filledCount++
              } catch (e) {
                console.warn(`  ⚠️ setText() fehlgeschlagen:`, e)
              }
            } else if (typeof fieldAny.updateAppearances === 'function') {
              // Manche Felder benötigen updateAppearances
              try {
                if (typeof fieldAny.setText === 'function') {
                  fieldAny.setText(value)
                  // Zentriere den Text
                  try {
                    if (typeof fieldAny.setAlignment === 'function') {
                      fieldAny.setAlignment(TextAlignment.Center)
                      console.log(`  ✅ Feld-Text zentriert`)
                    }
                  } catch (alignError) {
                    console.warn(`  ⚠️ Konnte Text nicht zentrieren:`, alignError)
                  }
                }
                fieldAny.updateAppearances()
                console.log(`  ✅ Feld mit updateAppearances() gesetzt: "${value}"`)
                filledCount++
              } catch (e) {
                console.warn(`  ⚠️ updateAppearances() fehlgeschlagen:`, e)
              }
            }
          }
        } catch (e) {
          const currentFieldName = field.getName()
          console.error(`  ❌ Fehler beim Füllen des Feldes "${currentFieldName}" (Index ${fieldIndex}):`, e)
          if (e instanceof Error) {
            console.error(`     Stack:`, e.stack)
          }
        }
      }
    }
    
    console.log(`\n📊 Zusammenfassung: ${filledCount} von ${fields.length} Feldern gefüllt`)
    
    // Flatten form (macht Formularfelder zu statischem Text)
    if (form) {
      console.log(`🔄 Flatten Formularfelder...`)
      try {
        form.flatten()
        console.log('✅ Formularfelder gefüllt und geflattened')
      } catch (flattenError) {
        console.warn('⚠️ Fehler beim Flatten, versuche ohne Flatten:', flattenError)
        // Flatten ist optional - wenn es fehlschlägt, können wir trotzdem fortfahren
        // Die Felder sollten bereits gefüllt sein
        if (flattenError instanceof Error) {
          console.warn('   Flatten-Fehler:', flattenError.message)
        }
      }
    } else {
      console.warn('⚠️ Kein Formular-Objekt verfügbar zum Flatten')
    }
  } catch (e) {
    console.error('❌ Fehler beim Füllen der Formularfelder:', e)
    if (e instanceof Error) {
      console.error('   Fehler-Name:', e.name)
      console.error('   Fehler-Message:', e.message)
      console.error('   Stack:', e.stack)
    }
    // Wir werfen den Fehler weiter, damit der Aufrufer ihn sehen kann
    throw new Error(`Fehler beim Füllen der PDF-Formularfelder: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`)
  }
  
  return filledDoc
}

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Starte PDF-Generierung für Namensschilder...')
    
    const formData = await request.formData()
    const guestsJson = formData.get('guests') as string
    const useTemplateStr = formData.get('useTemplate') as string
    const useTemplate = useTemplateStr === 'true'
    const templateFile = formData.get('template') as File | null
    const fieldMappingJson = formData.get('fieldMapping') as string | null
    const countStr = formData.get('count') as string
    const settingsJson = formData.get('settings') as string
    const orientationStr = formData.get('orientation') as string
    const logoFile = formData.get('logo') as File | null
    
    // Parse field mapping
    let fieldMapping: { [pdfFieldName: string]: string } = {}
    if (fieldMappingJson) {
      try {
        fieldMapping = JSON.parse(fieldMappingJson)
      } catch (e) {
        console.error('Fehler beim Parsen des Field-Mappings:', e)
      }
    }

    const cardOrientation = (orientationStr === 'landscape' ? 'landscape' : 'portrait') as 'portrait' | 'landscape'

    if (!guestsJson) {
      console.error('❌ Keine Gäste-Daten gefunden')
      return NextResponse.json(
        { error: 'Keine Gäste-Daten gefunden' },
        { status: 400 }
      )
    }

    let guests
    try {
      guests = JSON.parse(guestsJson)
    } catch (e) {
      console.error('❌ Fehler beim Parsen der Gäste-Daten:', e)
      return NextResponse.json(
        { error: 'Ungültige Gäste-Daten' },
        { status: 400 }
      )
    }

    let settings = null
    if (settingsJson) {
      try {
        settings = JSON.parse(settingsJson)
      } catch (e) {
        console.error('❌ Fehler beim Parsen der Einstellungen:', e)
        // Weiter mit Standard-Einstellungen
      }
    }

    const namensschildCount = parseInt(countStr || '4', 10)

    if (!Array.isArray(guests) || guests.length === 0) {
      console.error('❌ Keine Gäste zum Generieren gefunden')
      return NextResponse.json(
        { error: 'Keine Gäste zum Generieren gefunden' },
        { status: 400 }
      )
    }

    // Template-Modus
    if (useTemplate && templateFile) {
      console.log(`📄 Template-Modus: Generiere PDF für ${guests.length} Gäste mit Template`)
      
      try {
        // Lade Template-Bytes (einmal für alle Gäste)
        const templateBytes = await templateFile.arrayBuffer()
        console.log('✅ Template geladen')
        
        // Erstelle neues PDF-Dokument
        const finalDoc = await PDFDocument.create()
        
        // Bestimme Anzahl Gäste pro Seite basierend auf Feldnummern (1-4)
        // Lade Template einmal, um Feldanzahl zu bestimmen
        const tempDoc = await PDFDocument.load(templateBytes)
        const tempForm = tempDoc.getForm()
        const tempFields = tempForm.getFields()
        
        // Analysiere Felder: Finde höchste Nummer in Feldnamen (z.B. "Name4" → 4 Gäste)
        let maxGuestsPerPage = 1
        const fieldAnalysis: { [baseName: string]: { count: number, maxIndex: number, mapped: string } } = {}
        
        for (const field of tempFields) {
          const fieldName = field.getName()
          const numberMatch = fieldName.match(/^(.+?)([1-9])$/)
          
          if (numberMatch) {
            // Feld hat Nummer am Ende
            const baseName = numberMatch[1]
            const fieldIndex = parseInt(numberMatch[2])
            
            if (!fieldAnalysis[baseName]) {
              fieldAnalysis[baseName] = { count: 0, maxIndex: 0, mapped: '' }
            }
            fieldAnalysis[baseName].count++
            fieldAnalysis[baseName].maxIndex = Math.max(fieldAnalysis[baseName].maxIndex, fieldIndex)
            
            // Prüfe Zuordnung
            if (fieldMapping[baseName]) {
              fieldAnalysis[baseName].mapped = fieldMapping[baseName]
            } else if (fieldMapping[fieldName]) {
              fieldAnalysis[baseName].mapped = fieldMapping[fieldName]
            }
            
            // Aktualisiere maxGuestsPerPage wenn Feld zugeordnet ist
            if (fieldAnalysis[baseName].mapped) {
              maxGuestsPerPage = Math.max(maxGuestsPerPage, fieldIndex)
            }
          } else {
            // Feld ohne Nummer
            if (!fieldAnalysis[fieldName]) {
              fieldAnalysis[fieldName] = { count: 1, maxIndex: 0, mapped: fieldMapping[fieldName] || '' }
            }
          }
        }
        
        console.log(`📊 Feld-Analyse:`)
        for (const [name, data] of Object.entries(fieldAnalysis)) {
          const mapped = data.mapped ? ` → ${data.mapped}` : ''
          const indexInfo = data.maxIndex > 0 ? ` (max Index: ${data.maxIndex})` : ''
          console.log(`  - "${name}": ${data.count}x${mapped}${indexInfo}`)
        }
        console.log(`📊 Maximale Gäste pro Seite (basierend auf Feldnummern): ${maxGuestsPerPage}`)
        
        // Entferne Duplikate basierend auf Gast-ID
        const uniqueGuests: any[] = []
        const seenGuestIds = new Set<string>()
        for (const guest of guests) {
          const guestId = guest.id || guest.name || JSON.stringify(guest)
          if (!seenGuestIds.has(guestId)) {
            seenGuestIds.add(guestId)
            uniqueGuests.push(guest)
          } else {
            console.warn(`⚠️ Doppelter Gast übersprungen: ${guest.name || guest.id}`)
          }
        }
        
        if (uniqueGuests.length !== guests.length) {
          console.warn(`⚠️ ${guests.length - uniqueGuests.length} doppelte Gäste entfernt`)
        }
        
        console.log(`👥 Eindeutige Gäste: ${uniqueGuests.length} von ${guests.length} ursprünglichen Gästen`)
        
        // Gruppiere Gäste: maxGuestsPerPage Gäste pro Seite
        const guestGroups: any[][] = []
        for (let i = 0; i < uniqueGuests.length; i += maxGuestsPerPage) {
          guestGroups.push(uniqueGuests.slice(i, i + maxGuestsPerPage))
        }
        
        console.log(`📄 Erstelle ${guestGroups.length} Seite(n) mit je bis zu ${maxGuestsPerPage} Gast/Gästen`)
        
        // Validierung: Prüfe dass alle Gäste in Gruppen sind
        const totalGuestsInGroups = guestGroups.reduce((sum, group) => sum + group.length, 0)
        if (totalGuestsInGroups !== uniqueGuests.length) {
          console.error(`❌ FEHLER: Nicht alle Gäste in Gruppen! Erwartet: ${uniqueGuests.length}, Gefunden: ${totalGuestsInGroups}`)
          throw new Error(`Nicht alle Gäste konnten gruppiert werden. Erwartet: ${uniqueGuests.length}, Gefunden: ${totalGuestsInGroups}`)
        }
        
        // Tracking: Welche Gäste wurden verarbeitet
        const processedGuestIds = new Set<string>()
        
        // Für jede Gruppe: Template kopieren und füllen
        for (let groupIndex = 0; groupIndex < guestGroups.length; groupIndex++) {
          const guestGroup = guestGroups[groupIndex]
          const groupGuestIds = guestGroup.map(g => g.id || g.name || JSON.stringify(g))
          
          console.log(`\n📝 Verarbeite Gruppe ${groupIndex + 1}/${guestGroups.length} mit ${guestGroup.length} Gast/Gästen`)
          console.log(`  👥 Gäste in Gruppe: ${guestGroup.map(g => g.name || g.id).join(', ')}`)
          
          // Prüfe ob Gäste bereits verarbeitet wurden
          const alreadyProcessed = groupGuestIds.filter(id => processedGuestIds.has(id))
          if (alreadyProcessed.length > 0) {
            console.error(`  ❌ FEHLER: ${alreadyProcessed.length} Gast/Gäste wurden bereits verarbeitet: ${alreadyProcessed.join(', ')}`)
            throw new Error(`Doppelte Verarbeitung erkannt: ${alreadyProcessed.join(', ')}`)
          }
          
          try {
            // Fülle Template mit Gast-Gruppe (jedes Mal neu laden für saubere Kopie)
            const filledDoc = await fillTemplateWithMultipleGuests(templateBytes, guestGroup, getFieldValue, fieldMapping)
            
            // Markiere Gäste als verarbeitet
            for (const guestId of groupGuestIds) {
              processedGuestIds.add(guestId)
            }
            
            // Kopiere alle Seiten des gefüllten Templates ins finale Dokument
            const pageCount = filledDoc.getPageCount()
            console.log(`  📄 Seiten im gefüllten Template: ${pageCount}`)
            
            if (pageCount === 0) {
              console.warn(`  ⚠️ Template hat keine Seiten für Gruppe ${groupIndex + 1}`)
              continue
            }
            
            const pageIndices = Array.from({ length: pageCount }, (_, idx) => idx)
            console.log(`  📋 Kopiere Seiten: [${pageIndices.join(', ')}]`)
            
            const copiedPages = await finalDoc.copyPages(filledDoc, pageIndices)
            console.log(`  ✅ ${copiedPages.length} Seite(n) kopiert`)
            
            for (const page of copiedPages) {
              finalDoc.addPage(page)
            }
            
            console.log(`✅ Gruppe ${groupIndex + 1}/${guestGroups.length} verarbeitet (${pageCount} Seite(n), ${guestGroup.length} Gast/Gäste)`)
          } catch (groupError) {
            console.error(`❌ Fehler beim Verarbeiten von Gruppe ${groupIndex + 1}:`, groupError)
            if (groupError instanceof Error) {
              console.error('   Stack:', groupError.stack)
            }
            // Weiter mit nächster Gruppe, aber Fehler protokollieren
            throw new Error(`Fehler beim Verarbeiten von Gruppe ${groupIndex + 1}: ${groupError instanceof Error ? groupError.message : 'Unbekannter Fehler'}`)
          }
        }
        
        // Finale Validierung: Prüfe dass alle Gäste verarbeitet wurden
        const allGuestIds = uniqueGuests.map(g => g.id || g.name || JSON.stringify(g))
        const missingGuests = allGuestIds.filter(id => !processedGuestIds.has(id))
        
        if (missingGuests.length > 0) {
          console.error(`❌ FEHLER: ${missingGuests.length} Gast/Gäste wurden nicht verarbeitet:`)
          for (const missingId of missingGuests) {
            const missingGuest = uniqueGuests.find(g => (g.id || g.name || JSON.stringify(g)) === missingId)
            console.error(`  - ${missingGuest?.name || missingGuest?.id || missingId}`)
          }
          throw new Error(`${missingGuests.length} Gast/Gäste wurden nicht verarbeitet`)
        }
        
        console.log(`\n✅ Validierung erfolgreich:`)
        console.log(`  - ${uniqueGuests.length} eindeutige Gäste`)
        console.log(`  - ${processedGuestIds.size} Gäste verarbeitet`)
        console.log(`  - ${guestGroups.length} Seiten erstellt`)
        console.log(`  - Keine Duplikate`)
        console.log(`  - Alle Gäste eingetragen`)
        
        // PDF generieren
        console.log('📄 Speichere PDF...')
        const pdfBytes = await finalDoc.save()
        console.log(`✅ PDF erfolgreich generiert (${pdfBytes.length} Bytes)`)
        
        return new NextResponse(pdfBytes as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="namensschilder-${new Date().toISOString().split('T')[0]}.pdf"`,
          },
        })
      } catch (error) {
        console.error('❌ Fehler beim Verarbeiten des Templates:', error)
        if (error instanceof Error) {
          console.error('   Fehler-Name:', error.name)
          console.error('   Fehler-Message:', error.message)
          console.error('   Fehler-Stack:', error.stack)
        }
        
        // Detaillierte Fehlermeldung für den Client
        let errorMessage = 'Fehler beim Verarbeiten des PDF-Templates'
        if (error instanceof Error) {
          errorMessage = error.message
          // Spezifische Fehlermeldungen
          if (error.message.includes('getForm')) {
            errorMessage = 'Das PDF enthält keine Formularfelder. Bitte erstellen Sie ein PDF mit Formularfeldern.'
          } else if (error.message.includes('setText')) {
            errorMessage = 'Fehler beim Ausfüllen der Formularfelder. Bitte prüfen Sie die Feld-Zuordnung.'
          } else if (error.message.includes('flatten')) {
            errorMessage = 'Fehler beim Verarbeiten des PDF-Formulars. Das PDF könnte beschädigt sein.'
          }
        }
        
        return NextResponse.json(
          { 
            error: errorMessage,
            details: error instanceof Error ? error.message : 'Unbekannter Fehler',
            // In Development: Mehr Details
            ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
              stack: error.stack,
              name: error.name,
            } : {})
          },
          { status: 500 }
        )
      }
    }

    // Standard-Modus (bestehende Logik)
    console.log(`📄 Standard-Modus: Generiere PDF für ${guests.length} Gäste mit ${namensschildCount} Namensschildern pro Seite`)

    // Erstelle PDF-Dokument
    console.log('📄 Erstelle PDF-Dokument...')
    const pdfDoc = await PDFDocument.create()

    // Fonts einbetten (einmal für alle Seiten)
    console.log('📄 Bette Fonts ein...')
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    console.log('✅ Fonts eingebettet')

    // Logo einbetten (falls vorhanden)
    let logoImage: PDFImage | undefined
    if (logoFile) {
      try {
        console.log('📄 Bette Logo ein...')
        const logoBytes = await logoFile.arrayBuffer()
        const logoImageData = await pdfDoc.embedPng(logoBytes).catch(async () => {
          // Falls PNG fehlschlägt, versuche JPG
          console.log('📄 Versuche Logo als JPG einzubetten...')
          return await pdfDoc.embedJpg(logoBytes)
        })
        logoImage = logoImageData
        console.log('✅ Logo eingebettet')
      } catch (e) {
        console.error('❌ Fehler beim Einbetten des Logos:', e)
        // Weiter ohne Logo
      }
    }

    // Karten-Dimensionen basierend auf Ausrichtung
    const cardWidth = cardOrientation === 'landscape' ? CARD_HEIGHT_POINTS : CARD_WIDTH_POINTS  // 120mm oder 85mm
    const cardHeight = cardOrientation === 'landscape' ? CARD_WIDTH_POINTS : CARD_HEIGHT_POINTS  // 85mm oder 120mm

    // Berechne Layout basierend auf Anzahl - IMMER Portrait (Längsformat)
    // A4 Portrait: 595.28 x 841.89 Punkte (Breite x Höhe)
    // Berechne wie viele Karten auf eine A4-Seite passen
    const margin = 20
    const spacing = 10
    
    // Berechne maximale Anzahl Spalten und Zeilen
    const maxCols = Math.floor((A4_WIDTH - margin * 2 + spacing) / (cardWidth + spacing))
    const maxRows = Math.floor((A4_HEIGHT - margin * 2 + spacing) / (cardHeight + spacing))
    
    // Bestimme optimale Verteilung
    let cols = 1
    let rows = namensschildCount

    if (namensschildCount === 2) {
      cols = Math.min(2, maxCols)
      rows = Math.ceil(namensschildCount / cols)
    } else if (namensschildCount === 4) {
      cols = Math.min(2, maxCols)
      rows = Math.ceil(namensschildCount / cols)
    } else if (namensschildCount === 6) {
      cols = Math.min(2, maxCols)
      rows = Math.ceil(namensschildCount / cols)
    } else if (namensschildCount === 8) {
      cols = Math.min(2, maxCols)
      rows = Math.ceil(namensschildCount / cols)
    }

    // Verwende feste Karten-Größe
    const namensschildWidth = cardWidth
    const namensschildHeight = cardHeight

    // Generiere Namensschilder
    console.log('📄 Generiere Namensschilder...')
    let guestIndex = 0
    let currentPage = 0

    while (guestIndex < guests.length) {
      // Neue Seite für jede Gruppe - IMMER Portrait (Längsformat)
      // A4 Portrait: Breite x Höhe = 595.28 x 841.89 Punkte
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      console.log(`📄 Erstelle Seite ${currentPage + 1} im Portrait-Format (${A4_WIDTH}x${A4_HEIGHT})...`)
      
      // Platziere Namensschilder auf der Seite (zentriert)
      const totalWidth = cols * namensschildWidth + (cols - 1) * spacing
      const totalHeight = rows * namensschildHeight + (rows - 1) * spacing
      const startX = (A4_WIDTH - totalWidth) / 2
      const startY = A4_HEIGHT - margin - totalHeight
      
      for (let row = 0; row < rows && guestIndex < guests.length; row++) {
        for (let col = 0; col < cols && guestIndex < guests.length; col++) {
          const x = startX + col * (namensschildWidth + spacing)
          const y = startY + row * (namensschildHeight + spacing)

          try {
          await drawNamensschild(
            page,
            guests[guestIndex],
            x,
            y,
            namensschildWidth,
            namensschildHeight,
            logoImage,
            helveticaFont,
            helveticaBoldFont,
            settings,
            cardOrientation
          )
            console.log(`✅ Namensschild ${guestIndex + 1} erstellt für: ${guests[guestIndex].name || 'Unbekannt'}`)
          } catch (e) {
            console.error(`❌ Fehler beim Erstellen des Namensschilds für Gast ${guestIndex + 1}:`, e)
            // Weiter mit nächstem Gast
          }

          guestIndex++
        }
      }

      currentPage++
    }

    // PDF generieren
    console.log('📄 Speichere PDF...')
    const pdfBytes = await pdfDoc.save()
    console.log(`✅ PDF erfolgreich generiert (${pdfBytes.length} Bytes)`)

    return new NextResponse(pdfBytes as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="namensschilder.pdf"`,
      },
    })
  } catch (error) {
    console.error('Fehler beim Generieren der Namensschilder:', error)
    
    // Detailliertes Logging
    if (error instanceof Error) {
      console.error('Fehler-Stack:', error.stack)
      console.error('Fehler-Name:', error.name)
      console.error('Fehler-Message:', error.message)
    }
    
    return NextResponse.json(
      { 
        error: 'Fehler beim Generieren der Namensschilder',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler',
        // In Development: Mehr Details
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
          stack: error.stack,
          name: error.name,
        } : {})
      },
      { status: 500 }
    )
  }
}
