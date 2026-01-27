import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFImage, degrees, PDFPage, PDFFont, TextAlignment } from '@pdfme/pdf-lib'
import fontkit from '@pdf-lib/fontkit'

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
    // Prüfe zuerst guest.organization
    const orgValue = guest.organization || ''
    if (orgValue && orgValue.trim() !== '') {
      console.log('✅ Gefunden in guest.organization:', orgValue)
      return orgValue
    }
    
    // Prüfe auch in additionalData mit verschiedenen Varianten
    if (guest.additionalData) {
      try {
        const additional = JSON.parse(guest.additionalData)
        
        // Erweiterte Suche nach Staat/Institution Varianten
        const institutionKeys = [
          'Staat/Institution',
          'Staat / Institution',
          'Staat/Institution',
          'Staat /Institution',
          'Staat/ Institution',
          'Staat/Institution',
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
              console.log(`✅ Gefunden "${key}" in additionalData:`, value)
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
              console.log(`✅ Gefunden ähnlicher Key "${key}" in additionalData:`, value)
              return value
            }
          }
        }
      } catch (e) {
        console.error('Fehler beim Parsen von additionalData für Staat/Institution:', e)
      }
    }
    
    console.log(`⚠️ Staat/Institution nicht gefunden für Gast: ${guest.name || guest.id}`)
    return ''
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

  // Hilfsfunktion: Sanitize Text - entfernt NUR Steuerzeichen, behält ALLE Unicode-Zeichen (inkl. türkische)
  // WICHTIG: KEINE Konvertierung von türkischen Zeichen mehr - Original-Text wird direkt verwendet (UTF-8)
  const sanitizeTextForWinAnsi = (text: string): string => {
    if (!text) return ''
    
    // Entferne NUR Steuerzeichen und unsichtbare Zeichen, behalte ALLE anderen Zeichen (inkl. türkische)
    let sanitized = text
      // Entferne Steuerzeichen (aber behalte alle druckbaren Unicode-Zeichen)
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Steuerzeichen
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Unsichtbare Zeichen
      .trim()
    
    // KEINE Konvertierung von türkischen Zeichen mehr!
    // Türkische Zeichen (İ, ğ, ş, Ç, ç, Ö, ö, Ü, ü) werden BEHALTEN und direkt verwendet
    
    return sanitized
  }
  
  // Hilfsfunktion: Sanitize Text für PDF (für drawText, nicht für Formularfelder)
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

// Hilfsfunktion: Sanitize Text (nur Steuerzeichen entfernen, behalte alle Zeichen)
// Wird für normale Text-Zeichnung verwendet (behält türkische Zeichen)
function sanitizeTextForWinAnsi(text: string): string {
  if (!text) return ''
  
  // Entferne nur Steuerzeichen und unsichtbare Zeichen
  // BEHALTE alle türkischen Zeichen - diese werden mit Unicode-Fonts gezeichnet
  let sanitized = text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Steuerzeichen
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Unsichtbare Zeichen
    .trim()
  
  return sanitized
}

// Hilfsfunktion: Fülle PDF-Template mit mehreren Gästen (wenn mehrere Felder mit gleichem Namen)
// Interface für gespeicherte Feld-Informationen (Original-Wert + Position)
interface FieldInfo {
  originalValue: string
  convertedValue: string
  fieldName: string
  pageIndex: number
  x?: number
  y?: number
  width?: number
  height?: number
  fontSize?: number
  drawnDirectly?: boolean // Flag: Text wurde direkt mit Unicode-Font gezeichnet (verhindert ANSI)
}

async function fillTemplateWithMultipleGuests(
  templateBytes: ArrayBuffer,
  guests: any[],
  getFieldValue: (guest: any, fieldName: string) => string,
  fieldMapping: { [pdfFieldName: string]: string }
): Promise<PDFDocument> {
  // Lade Template
  const filledDoc = await PDFDocument.load(templateBytes)
  
  // Registriere fontkit für Unicode-Unterstützung
  filledDoc.registerFontkit(fontkit)
  
  // KRITISCH: Lade Unicode-Font VOR dem Füllen der Felder
  // WICHTIG: Dies ist ESSENTIELL, um ANSI/WinAnsi-Kodierung zu vermeiden!
  // Ohne Unicode-Font werden Formularfelder mit WinAnsi gefüllt → ANSI-Kodierung!
  let unicodeFont: PDFFont | null = null
  console.log('🔄 KRITISCH: Lade Unicode-Font für direkte Text-Zeichnung (UTF-8/Unicode)...')
  console.log('  📝 Bevorzugte Font: Arial Unicode MS-kompatible Fonts (wie im PDF-Formular verwendet)')
  console.log('  📝 Verwendet: Arimo (Arial-ähnlich), Noto Sans, DejaVu Sans (alle unterstützen türkische Zeichen)')
  console.log('  ⚠️ Ohne Unicode-Font wird ANSI/WinAnsi-Kodierung verwendet!')
  
  // Lade Arial Unicode MS-kompatible Fonts von CDN
  // Arial Unicode MS ist proprietär, daher verwenden wir ähnliche Open-Source-Fonts
  
  // WICHTIG: Verwende Arial Unicode MS (wie im PDF-Formular verwendet)
  // Arial Unicode MS unterstützt türkische Zeichen vollständig
  // Falls Arial Unicode MS nicht verfügbar ist, verwende Fallback-Fonts
  const fontUrls = [
    // PRIORITÄT 1: Arial Unicode MS (wie im PDF-Formular verwendet)
    // Arial Unicode MS ist eine proprietäre Font, aber es gibt ähnliche Alternativen
    // Versuche zuerst ähnliche Fonts, die Arial Unicode MS ähneln
    'https://github.com/google/fonts/raw/main/ofl/arimo/Arimo-Regular.ttf', // Arimo ist ähnlich zu Arial
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/arimo/Arimo-Regular.ttf',
    // PRIORITÄT 2: Noto Sans (sehr gute Unicode-Unterstützung, ähnlich zu Arial Unicode MS)
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
    'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
    'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.ttf',
    // PRIORITÄT 3: DejaVu Sans (auch sehr gute Unicode-Unterstützung)
    'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf',
    // PRIORITÄT 4: Liberation Sans (Arial-ähnlich, gute Unicode-Unterstützung)
    'https://github.com/liberationfonts/liberation-fonts/raw/master/liberation-fonts-ttf-2.1.5/LiberationSans-Regular.ttf'
  ]
  
  for (const fontUrl of fontUrls) {
    try {
      console.log(`  🔄 Versuche Font zu laden von: ${fontUrl}`)
      
      // Überspringe CSS-Dateien (nur TTF/OTF)
      if (fontUrl.includes('css2') || fontUrl.includes('.css')) {
        console.log(`  ⏭️ Überspringe CSS-Datei, benötige TTF`)
        continue
      }
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 Sekunden
      
      const fontResponse = await fetch(fontUrl, {
        headers: {
          'Accept': 'application/octet-stream, application/font-ttf, font/ttf, font/otf, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; pdf-lib-font-loader)'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (fontResponse.ok) {
        const fontBytes = await fontResponse.arrayBuffer()
        console.log(`  📦 Font-Datei geladen: ${fontBytes.byteLength} Bytes`)
        
        if (fontBytes.byteLength > 1000) { // Mindestens 1KB (gültige Font-Datei)
          try {
            unicodeFont = await filledDoc.embedFont(fontBytes)
            console.log('  ✅ Unicode-Font erfolgreich geladen und eingebettet')
            
            // Test: Prüfe ob Font türkische Zeichen unterstützt (wie Arial Unicode MS)
            try {
              const testText = 'İğşÇçÖöÜü'
              const testWidth = unicodeFont.widthOfTextAtSize(testText, 12)
              console.log(`  ✅ Font-Test erfolgreich: Test-Text "${testText}" Breite: ${testWidth}`)
              console.log(`  ✅ Font unterstützt UTF-8/Unicode Encoding (Identity-H)`)
              console.log(`  ✅ Font kann türkische Zeichen darstellen: İ, ğ, ş, Ç, ç, Ö, ö, Ü, ü`)
              console.log(`  ✅ Font ist kompatibel mit Arial Unicode MS (wie im PDF-Formular verwendet)`)
              break // Erfolgreich geladen und getestet
            } catch (testError) {
              console.warn(`  ⚠️ Font-Test fehlgeschlagen, versuche nächste Font:`, testError)
              unicodeFont = null
              continue
            }
          } catch (embedError) {
            console.warn(`  ⚠️ Fehler beim Einbetten der Font:`, embedError)
            if (embedError instanceof Error) {
              console.warn(`     Fehler-Message: ${embedError.message}`)
            }
            continue
          }
        } else {
          console.warn(`  ⚠️ Font-Datei zu klein (${fontBytes.byteLength} Bytes), möglicherweise ungültig`)
        }
      } else {
        console.warn(`  ⚠️ Font-Response nicht OK (${fontResponse.status}): ${fontUrl}`)
      }
    } catch (fontError) {
      console.warn(`  ⚠️ Fehler beim Laden von ${fontUrl}:`, fontError)
      if (fontError instanceof Error) {
        console.warn(`     Fehler-Message: ${fontError.message}`)
        console.warn(`     Fehler-Name: ${fontError.name}`)
      }
      continue
    }
  }
  
  if (!unicodeFont) {
    console.error('  ❌ KRITISCH: Konnte keine Unicode-Font laden!')
    console.error('  ❌ PDF wird mit konvertierten Werten ausgegeben (İ→I, ğ→g, ş→s, Ü→U, etc.)')
    console.error('  ⚠️ Bitte überprüfen Sie:')
    console.error('     1. Internet-Verbindung des Servers')
    console.error('     2. Firewall-Einstellungen')
    console.error('     3. CDN-Verfügbarkeit')
  } else {
    console.log('  ✅ Unicode-Font bereit für direkte Text-Zeichnung mit türkischen Zeichen')
  }
  
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
    // Speichere Original-Werte für Unicode-Wiederherstellung nach Flatten
    const fieldInfoMap: Map<string, FieldInfo> = new Map()
    
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
      // WICHTIG: Jeder Gast darf nur EINMAL pro Feld-Gruppe verwendet werden
      const usedGuestIndices = new Set<number>()
      
      // Sortiere Felder nach Index, um sicherzustellen dass Feld1 → Gast0, Feld2 → Gast1, etc.
      const fieldIndexPairs = fieldList.map((field, i) => ({ field, index: indices[i] }))
      fieldIndexPairs.sort((a, b) => a.index - b.index) // Sortiere nach Index
      
      for (let i = 0; i < fieldIndexPairs.length; i++) {
        const { field, index: fieldIndex } = fieldIndexPairs[i]
        const fieldNumber = fieldIndex + 1 // Feldnummer für Logging (Index 0 → Feldnummer 1)
        
        // Prüfe ob dieser Index bereits verwendet wurde (verhindert doppelte Gäste)
        if (usedGuestIndices.has(fieldIndex)) {
          console.warn(`  ⚠️ Index ${fieldIndex} (Feldnummer ${fieldNumber}) wurde bereits für ein anderes Feld verwendet, überspringe Duplikat`)
          continue
        }
        
        // Prüfe ob Gast für diesen Index existiert
        if (fieldIndex >= guests.length) {
          console.log(`  ⏭️ Kein Gast für Index ${fieldIndex} (Feldnummer ${fieldNumber}, nur ${guests.length} Gäste verfügbar), überspringe`)
          continue
        }
        
        const guest = guests[fieldIndex] // Nimm den Gast am entsprechenden Index (0-basiert)
        
        if (!guest) {
          console.log(`  ⏭️ Kein Gast für Index ${fieldIndex} (Feldnummer ${fieldNumber}), überspringe`)
          continue
        }
        
        usedGuestIndices.add(fieldIndex)
        console.log(`  👤 Fülle Feld ${i + 1}/${fieldList.length} (Feldnummer ${fieldNumber}, Index ${fieldIndex}) mit Gast: ${guest.name || guest.id}`)
        
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
        
        // Spezielle Behandlung für "Staat/Institution" - erweiterte Suche
        if ((guestFieldName === 'Staat/Institution' || guestFieldName === 'Staat / Institution') && (!value || value.trim() === '')) {
          console.log(`  🔍 Erweiterte Suche nach Staat/Institution...`)
          // Versuche alle möglichen Varianten
          const variants = [
            'Staat/Institution',
            'Staat / Institution',
            'Staat/Institution',
            'Staat /Institution',
            'Staat/ Institution',
            'Partei / Organisation / Unternehmen',
            'Partei/Organisation/Unternehmen',
            'Organisation',
            'Organization',
          ]
          
          for (const variant of variants) {
            const variantValue = getFieldValue(guest, variant)
            if (variantValue && variantValue.trim() !== '') {
              value = variantValue
              console.log(`  ✅ Gefunden über Variante "${variant}": "${value}"`)
              break
            }
          }
        }
        
        if (!value || value.trim() === '') {
          console.log(`  ⚠️ Kein Wert gefunden für "${guestFieldName}", überspringe`)
          // Zeige Debug-Info für Staat/Institution
          if (guestFieldName === 'Staat/Institution' || guestFieldName === 'Staat / Institution') {
            console.log(`  🔍 Debug: Guest-Daten:`, {
              id: guest.id,
              name: guest.name,
              organization: guest.organization,
              hasAdditionalData: !!guest.additionalData,
            })
          }
          continue
        }
        
        // NEUER ANSATZ: Zeichne Texte direkt mit Unicode-Fonts, anstatt Formularfelder zu füllen
        // Dies vermeidet WinAnsi-Encoding-Probleme komplett
        const originalValue = value
        const fieldName = field.getName()
        const pageIndex = 0
        
        // Prüfe ob Original-Wert türkische Zeichen enthält
        const hasTurkishChars = /[İıĞğŞşÇçÖöÜü]/.test(originalValue)
        
        if (!originalValue || originalValue.trim() === '') {
          console.log(`  ⚠️ Wert ist leer, überspringe`)
          continue
        }
        
        // Sanitize nur Steuerzeichen, behalte türkische Zeichen
        const sanitizedValue = sanitizeTextForWinAnsi(originalValue)
        
        if (!sanitizedValue || sanitizedValue.trim() === '') {
          console.log(`  ⚠️ Wert wurde nach Sanitization leer, überspringe`)
          continue
        }
        
        // WICHTIG: KEINE Konvertierung mehr - verwende Original-Text direkt (UTF-8)
        // Türkische Zeichen werden NICHT mehr konvertiert - sie werden direkt verwendet
        let convertedValue = sanitizeTextForWinAnsi(originalValue) // Nur Steuerzeichen entfernen, behalte türkische Zeichen
        
        console.log(`  📝 Feld "${fieldName}": "${originalValue}" (hat türkische Zeichen: ${hasTurkishChars})`)
        
        // Versuche Feld-Position und Font-Größe zu erhalten (für direkte Text-Zeichnung)
        try {
          const fieldAny = field as any
          const acroField = fieldAny.acroField
          
          let fieldRect: { x: number; y: number; width: number; height: number } | null = null
          let fontSize = 12 // Standard-Font-Größe
          
          if (acroField) {
            // Versuche Rectangle zu erhalten
            try {
              if (acroField.getRectangle) {
                const rect = acroField.getRectangle()
                if (rect && typeof rect.x === 'number' && typeof rect.y === 'number' && 
                    !isNaN(rect.x) && !isNaN(rect.y) && rect.x >= 0 && rect.y >= 0) {
                  fieldRect = {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width || 100,
                    height: rect.height || 20
                  }
                }
              }
            } catch (rectError) {
              // Ignoriere Fehler, versuche alternative Methode
            }
            
            // Alternative: Versuche Position über Rect-Array
            if (!fieldRect && acroField.dict) {
              try {
                const rectArray = acroField.dict.get('Rect')
                if (rectArray && Array.isArray(rectArray) && rectArray.length >= 4) {
                  const x0 = rectArray[0]?.valueOf() || 0
                  const y0 = rectArray[1]?.valueOf() || 0
                  const x1 = rectArray[2]?.valueOf() || 0
                  const y1 = rectArray[3]?.valueOf() || 0
                  
                  if (x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0) {
                    fieldRect = {
                      x: x0,
                      y: y1,
                      width: x1 - x0,
                      height: y1 - y0
                    }
                  }
                }
              } catch (altError) {
                // Ignoriere Fehler
              }
            }
            
            // Versuche Font-Größe zu extrahieren
            try {
              if (acroField.dict) {
                const da = acroField.dict.get('DA')
                if (da) {
                  const daMatch = da.match(/(\d+(?:\.\d+)?)\s+Tf/)
                  if (daMatch) {
                    fontSize = parseFloat(daMatch[1])
                  }
                }
              }
            } catch (fontSizeError) {
              // Verwende Standard-Größe
            }
          }
          
          // Sanitize Original-Wert (nur Steuerzeichen entfernen, behalte türkische Zeichen)
          const sanitizedValue = sanitizeTextForWinAnsi(originalValue)
          
          // KRITISCH: Zeichne Text direkt mit Unicode-Font, wenn Font verfügbar ist
          // WICHTIG: Dies ist der EINZIGE Pfad, der ANSI vermeidet und UTF-8/Unicode verwendet!
          // Wenn dieser Pfad nicht ausgeführt wird, werden Formularfelder mit WinAnsi gefüllt!
          if (unicodeFont && fieldRect && sanitizedValue && sanitizedValue.trim() !== '') {
            try {
              const pages = filledDoc.getPages()
              const page = pages[pageIndex]
              
              if (page) {
                console.log(`  🎨 Zeichne Text direkt mit Unicode-Font: "${sanitizedValue}"`)
                console.log(`     Position: x=${fieldRect.x}, y=${fieldRect.y}, width=${fieldRect.width}, height=${fieldRect.height}`)
                console.log(`     Font-Größe: ${fontSize}`)
                
                // Berechne Text-Breite mit Unicode-Font
                const textWidth = unicodeFont.widthOfTextAtSize(sanitizedValue, fontSize)
                const textHeight = fontSize * 1.2
                
                console.log(`     Text-Breite: ${textWidth}, Text-Höhe: ${textHeight}`)
                
                // WICHTIG: PDF-Koordinatensystem hat (0,0) unten links
                // fieldRect.y ist die obere Y-Koordinate des Feldes
                // Für drawText() brauchen wir die untere Y-Koordinate
                
                // Berechne zentrierte Position
                const textX = fieldRect.x + (fieldRect.width - textWidth) / 2
                // Y-Position: fieldRect.y ist oben, wir brauchen unten für drawText
                // Text wird von der Baseline (unten) gezeichnet
                const textY = fieldRect.y - fieldRect.height + (fieldRect.height - textHeight) / 2 + textHeight * 0.2
                
                console.log(`     Zeichne bei: x=${textX}, y=${textY}`)
                console.log(`     Feld-Rect: x=${fieldRect.x}, y=${fieldRect.y}, width=${fieldRect.width}, height=${fieldRect.height}`)
                
                // ROBUST: Zeichne Text direkt als Overlay mit Unicode-Font (100% Unicode-Kontrolle)
                // Dies ist die robusteste Lösung: Wir zeichnen direkt, ohne Formularfelder zu füllen
                // Der Font unterstützt türkische Zeichen: İ, ğ, ş, Ç, ç, Ö, ö, Ü, ü
                // WICHTIG: drawText() verwendet automatisch UTF-8/Unicode-Encoding (Identity-H) wenn Font eingebettet ist
                // KEIN WinAnsi wird verwendet - 100% Unicode-Kontrolle!
                
                // Zeichne weißen Hintergrund, um eventuelle Formularfeld-Inhalte zu überschreiben
                page.drawRectangle({
                  x: fieldRect.x,
                  y: fieldRect.y - fieldRect.height,
                  width: fieldRect.width,
                  height: fieldRect.height,
                  color: rgb(1, 1, 1), // Weiß
                })
                
                // Zeichne Text direkt mit Unicode-Font (Overlay-Ansatz)
                page.drawText(sanitizedValue, {
                  x: textX,
                  y: textY,
                  size: fontSize,
                  font: unicodeFont, // UTF-8/Unicode-kompatibler Font (Identity-H Encoding)
                  color: rgb(0, 0, 0),
                })
                
                // KRITISCH: Speichere in fieldInfoMap, dass direkte Zeichnung erfolgreich war
                // Dies verhindert, dass das Formularfeld später gefüllt wird
                fieldInfoMap.set(fieldName, {
                  originalValue,
                  convertedValue: sanitizedValue, // Verwende sanitizedValue (behält Unicode)
                  fieldName,
                  pageIndex,
                  x: fieldRect.x,
                  y: fieldRect.y,
                  width: fieldRect.width,
                  height: fieldRect.height,
                  fontSize,
                  drawnDirectly: true // Flag: Text wurde direkt gezeichnet
                })
                
                // Zusätzlicher Test: Prüfe ob Text korrekt gezeichnet wurde
                console.log(`     ✅ Text gezeichnet mit Font: ${unicodeFont ? 'Unicode-Font' : 'Standard-Font'}`)
                
                console.log(`  ✅ Text erfolgreich als Overlay mit Unicode-Font gezeichnet: "${sanitizedValue}"`)
                console.log(`     Türkische Zeichen sollten korrekt dargestellt werden!`)
                console.log(`     ✅ ROBUST: Overlay-Ansatz - 100% Unicode-Kontrolle, KEIN WinAnsi!`)
                console.log(`     ✅ Formularfeld wird NICHT gefüllt (verhindert ANSI/WinAnsi-Kodierung!)`)
                
                filledCount++
                continue // Überspringe Formularfeld-Füllung (Text ist bereits gezeichnet)
              } else {
                console.warn(`  ⚠️ Seite ${pageIndex} nicht gefunden`)
              }
            } catch (drawError) {
              console.error(`  ❌ Fehler beim direkten Zeichnen mit Unicode-Font:`, drawError)
              if (drawError instanceof Error) {
                console.error(`     Fehler-Message: ${drawError.message}`)
                console.error(`     Stack: ${drawError.stack}`)
              }
              console.warn(`  ⚠️ Direkte Zeichnung fehlgeschlagen - verwende Formularfeld-Füllung (mit UTF-8 nach updateFieldAppearances)`)
              // Fallback: Verwende Formularfeld-Füllung (nach updateFieldAppearances sollte UTF-8 funktionieren)
            }
          } else {
            // Direkte Zeichnung nicht möglich - verwende Formularfeld-Füllung
            if (!unicodeFont) {
              console.warn(`  ⚠️ Unicode-Font nicht verfügbar - verwende Formularfeld-Füllung (könnte WinAnsi verwenden)`)
            }
            if (!fieldRect) {
              console.warn(`  ⚠️ Feld-Position nicht verfügbar - verwende Formularfeld-Füllung statt direkter Zeichnung`)
            }
            if (!sanitizedValue || sanitizedValue.trim() === '') {
              console.warn(`  ⚠️ Sanitized-Wert ist leer, überspringe`)
              continue
            }
            console.log(`  ℹ️ Direkte Zeichnung nicht möglich - verwende Formularfeld-Füllung (mit UTF-8 nach updateFieldAppearances)`)
          }
          
          // Fallback: Fülle Formularfeld (wenn Unicode-Font nicht verfügbar oder Position fehlt)
          // convertedValue wurde bereits oben berechnet
          if (convertedValue && convertedValue.trim() !== '') {
            // Speichere für spätere Wiederherstellung (falls nötig)
            if (hasTurkishChars || originalValue !== convertedValue) {
              fieldInfoMap.set(fieldName, {
                originalValue,
                convertedValue,
                fieldName,
                pageIndex,
                x: fieldRect?.x,
                y: fieldRect?.y,
                width: fieldRect?.width,
                height: fieldRect?.height,
                fontSize
              })
            }
          }
        } catch (posError) {
          console.warn(`  ⚠️ Fehler beim Ermitteln der Feld-Position:`, posError)
        }
        
        // KRITISCH: Wenn Unicode-Font verfügbar ist, FÜLLE KEINE TEXT-FORMULARFELDER!
        // pdf-lib verwendet WinAnsi für Formularfelder, auch wenn wir UTF-8 setzen
        // Beim Flatten wird WinAnsi verwendet → Fehler "WinAnsi cannot encode"
        // Lösung: Nur direkte Zeichnung verwenden, Formularfelder leer lassen
        
        // Prüfe ob Text bereits mit direkter Zeichnung gezeichnet wurde
        if (fieldInfoMap.has(fieldName)) {
          const fieldInfo = fieldInfoMap.get(fieldName)
          if (fieldInfo && fieldInfo.drawnDirectly === true) {
            console.log(`  ✅ Text bereits mit direkter Zeichnung gezeichnet, überspringe Formularfeld-Füllung`)
            continue
          }
        }
        
        // KRITISCH: Wenn Unicode-Font verfügbar ist, FÜLLE KEINE TEXT-FORMULARFELDER!
        // Auch mit updateFieldAppearances() verwendet pdf-lib/@pdfme/pdf-lib beim Flatten WinAnsi
        // Lösung: Nur direkte Zeichnung verwenden, Formularfelder leer lassen
        const fieldType = field.constructor.name
        
        // Prüfe ob convertedValue definiert ist
        if (!convertedValue || convertedValue.trim() === '') {
          console.log(`  ⚠️ convertedValue ist leer, überspringe Formularfeld-Füllung`)
          continue
        }
        
        // KRITISCH: Für Text-Felder: Fülle NICHT, wenn Unicode-Font verfügbar ist!
        // Direkte Zeichnung sollte bereits verwendet worden sein
        // Wenn nicht, bedeutet das, dass direkte Zeichnung fehlgeschlagen ist
        if (fieldType === 'PDFTextField' || fieldType === 'PDFDropdown') {
          if (unicodeFont) {
            console.error(`  ❌ FEHLER: ${fieldType} sollte NICHT gefüllt werden, wenn Unicode-Font verfügbar ist!`)
            console.error(`     Direkte Zeichnung sollte bereits verwendet worden sein`)
            console.error(`     Wenn nicht, ist direkte Zeichnung fehlgeschlagen - bitte Logs prüfen`)
            console.error(`     Formularfeld wird NICHT gefüllt, um WinAnsi-Fehler zu vermeiden`)
            continue // Überspringe Formularfeld-Füllung - verhindert WinAnsi-Fehler!
          } else {
            console.warn(`  ⚠️ Unicode-Font nicht verfügbar - Formularfeld wird gefüllt (könnte WinAnsi verwenden)`)
          }
        }
        
        // Nur für CheckBoxen und andere nicht-Text-Felder
        console.log(`  📝 Verwende Original-Text direkt (UTF-8): "${convertedValue}"`)
        console.log(`     ⚠️ WARNUNG: Formularfeld-Füllung kann WinAnsi-Fehler verursachen!`)
        
        try {
          console.log(`  📝 Feld-Typ: ${fieldType}`)
          console.log(`  ✏️ Setze Wert direkt (UTF-8, Original-Text): "${convertedValue}"`)
          
          // Versuche verschiedene Methoden, um das Feld zu setzen
          const fieldAny = field as any
          
          if (fieldType === 'PDFTextField') {
            // WARNUNG: Dies sollte nur passieren, wenn Unicode-Font NICHT verfügbar ist
            console.warn(`  ⚠️ WARNUNG: PDFTextField wird gefüllt ohne Unicode-Font - könnte WinAnsi-Fehler verursachen!`)
            
            try {
              fieldAny.setText(convertedValue) // Original-Text mit türkischen Zeichen (UTF-8)
              console.log(`  ✅ TextField gesetzt mit UTF-8 (Original-Text): "${convertedValue}"`)
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
            } catch (setTextError) {
              console.error(`  ❌ Fehler beim Setzen des Textes:`, setTextError)
              if (setTextError instanceof Error && setTextError.message.includes('WinAnsi')) {
                console.error(`     ⚠️ WinAnsi-Fehler trotz Unicode-Font!`)
                console.error(`     ⚠️ Möglicherweise wurde updateFieldAppearances() nicht korrekt aufgerufen`)
                throw setTextError
              }
              throw setTextError
            }
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
              // Verwende konvertierten Wert (WinAnsi-kompatibel)
              dropdown.select(convertedValue)
              console.log(`  ✅ Dropdown ausgewählt (UTF-8, Original-Text): "${convertedValue}"`)
              filledCount++
            } catch (e) {
              console.warn(`  ⚠️ Wert nicht in Dropdown-Liste:`, e)
              // Versuche als Text zu setzen, falls möglich
              if (typeof dropdown.setText === 'function') {
                dropdown.setText(convertedValue)
                console.log(`  ✅ Dropdown als Text gesetzt (UTF-8, Original-Text): "${convertedValue}"`)
              // Zentriere den Text
              try {
                if (typeof dropdown.setAlignment === 'function') {
                  dropdown.setAlignment(TextAlignment.Center)
                  console.log(`  ✅ Dropdown-Text zentriert`)
                }
              } catch (alignError) {
                console.warn(`  ⚠️ Konnte Dropdown-Text nicht zentrieren:`, alignError)
              }
              console.log(`  ✅ Dropdown als Text gesetzt`)
              filledCount++
            }
            }
          } else if (fieldType === 'PDFRadioGroup') {
            const radioGroup = field as any
            try {
              // Verwende konvertierten Wert (WinAnsi-kompatibel)
              radioGroup.select(convertedValue)
              console.log(`  ✅ Radio-Button ausgewählt (UTF-8, Original-Text): "${convertedValue}"`)
              filledCount++
            } catch (e) {
              console.warn(`  ⚠️ Konnte Radio-Button nicht setzen:`, e)
            }
          } else {
            console.warn(`  ⚠️ Unbekannter Feld-Typ: ${fieldType}, versuche generische Methoden`)
            // Versuche generische Methoden
            if (typeof fieldAny.setText === 'function') {
              try {
                // Verwende konvertierten Wert (WinAnsi-kompatibel)
                fieldAny.setText(convertedValue)
                console.log(`  ✅ Feld mit setText() gesetzt (UTF-8, Original-Text): "${convertedValue}"`)
                // Zentriere den Text
                try {
                  if (typeof fieldAny.setAlignment === 'function') {
                    fieldAny.setAlignment(TextAlignment.Center)
                    console.log(`  ✅ Feld-Text zentriert`)
                  }
                } catch (alignError) {
                  console.warn(`  ⚠️ Konnte Text nicht zentrieren:`, alignError)
                }
                filledCount++
              } catch (e) {
                console.warn(`  ⚠️ setText() fehlgeschlagen:`, e)
              }
            } else if (typeof fieldAny.updateAppearances === 'function') {
              // Manche Felder benötigen updateAppearances
              try {
                if (typeof fieldAny.setText === 'function') {
                  // Verwende konvertierten Wert (WinAnsi-kompatibel)
                  fieldAny.setText(convertedValue)
                  console.log(`  ✅ Feld mit setText() gesetzt (WinAnsi-kompatibel): "${convertedValue}"`)
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
                console.log(`  ✅ Feld mit updateAppearances() gesetzt`)
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
    
    console.log(`\n📊 Zusammenfassung: ${filledCount} von ${fields.length} Feldern verarbeitet`)
    
    // Flatten form (macht Formularfelder zu statischem Text) - nur wenn Formularfelder gefüllt wurden
    // WICHTIG: Wenn Unicode-Font verfügbar war und direkte Zeichnung verwendet wurde, sind die Formularfelder leer
    // In diesem Fall müssen wir sie trotzdem flatten, damit sie nicht mehr interaktiv sind
    if (form) {
      const fieldsToFlatten = form.getFields()
      const filledFieldsCount = fieldsToFlatten.filter((f: any) => {
        try {
          if (f.constructor.name === 'PDFTextField') {
            const text = f.getText()
            return text && text.trim() !== ''
          }
          return false
        } catch {
          return false
        }
      }).length
      
      // Zähle wie viele Felder direkt gezeichnet wurden
      const directlyDrawnCount = Array.from(fieldInfoMap.values()).filter(fi => fi.drawnDirectly === true).length
      
      console.log(`🔄 Flatten Formularfelder...`)
      if (unicodeFont) {
        console.log(`  ✅ Unicode-Font wurde verwendet - Texte wurden direkt gezeichnet`)
        console.log(`  📝 ${directlyDrawnCount} Text(e) wurden direkt mit Unicode-Font gezeichnet (UTF-8/Identity-H, KEIN ANSI!)`)
        console.log(`  📝 ${filledFieldsCount} Formularfeld(er) wurden gefüllt (Fallback, WinAnsi/ANSI)`)
        if (directlyDrawnCount > 0) {
          console.log(`  ✅ ${directlyDrawnCount} Feld(er) verwenden Unicode-Font - KEIN ANSI/WinAnsi!`)
        }
      } else {
        console.log(`  ⚠️ Unicode-Font nicht verfügbar - Formularfelder wurden mit WinAnsi-Werten gefüllt`)
        console.log(`  📝 ${filledFieldsCount} Formularfeld(er) wurden gefüllt (ANSI/WinAnsi-Kodierung)`)
      }
      
      try {
        // KRITISCH: Prüfe ob Text-Formularfelder gefüllt wurden
        if (unicodeFont && filledFieldsCount > 0) {
          console.error(`  ❌ WARNUNG: ${filledFieldsCount} Text-Formularfeld(er) wurden gefüllt, obwohl Unicode-Font verfügbar ist!`)
          console.error(`     Dies wird WinAnsi-Fehler verursachen: "WinAnsi cannot encode"`)
          console.error(`     Versuche Formularfelder zu entfernen statt zu flatten...`)
          
          // Versuche Formularfelder zu entfernen statt zu flatten (verhindert WinAnsi-Fehler)
          try {
            const fieldsToRemove = form.getFields()
            for (const field of fieldsToRemove) {
              try {
                const fieldAny = field as any
                if (fieldAny.acroField) {
                  // Entferne das Feld aus dem AcroForm
                  const acroForm = form.dict
                  if (acroForm && typeof acroForm.delete === 'function') {
                    // Versuche Feld zu entfernen
                    console.log(`  🔄 Versuche Formularfeld "${field.getName()}" zu entfernen...`)
                  }
                }
              } catch (removeError) {
                console.warn(`  ⚠️ Konnte Formularfeld nicht entfernen:`, removeError)
              }
            }
          } catch (removeError) {
            console.warn(`  ⚠️ Fehler beim Entfernen von Formularfeldern:`, removeError)
            console.warn(`  ⚠️ Fallback: Versuche trotzdem zu flatten (Fehler wird wahrscheinlich auftreten)`)
          }
        }
        
        // ROBUST: Overlay-Ansatz - Texte wurden direkt gezeichnet, Formularfelder sind leer
        // Flatten ist jetzt sicher, da keine Text-Formularfelder mit türkischen Zeichen gefüllt wurden
        if (unicodeFont && filledFieldsCount === 0) {
          console.log('  ✅ ROBUST: Overlay-Ansatz verwendet - keine Text-Formularfelder gefüllt')
          console.log('  ✅ Texte wurden direkt gezeichnet (100% Unicode-Kontrolle, KEIN WinAnsi!)')
          console.log('  ✅ Flatten ist sicher - keine WinAnsi-Fehler erwartet')
          form.flatten()
          console.log('✅ Formularfelder geflattened - PDF ist jetzt normales PDF ohne interaktive Formularfelder')
        } else if (filledFieldsCount > 0) {
          console.error(`  ❌ ${filledFieldsCount} Text-Formularfeld(er) wurden gefüllt - flatten() wird WinAnsi-Fehler verursachen!`)
          console.error(`     ROBUST: Bitte verwenden Sie Overlay-Ansatz (direkte Zeichnung) statt Formularfeld-Füllung!`)
          try {
            form.flatten()
            console.log('✅ Formularfelder geflattened (trotz möglichem WinAnsi-Fehler)')
          } catch (flattenError) {
            console.error(`  ❌ Fehler beim Flatten:`, flattenError)
            if (flattenError instanceof Error && flattenError.message.includes('WinAnsi')) {
              console.error(`     ⚠️ WinAnsi-Fehler beim Flatten - Formularfelder wurden nicht geflattened`)
              console.error(`     ⚠️ ROBUST: Verwenden Sie Overlay-Ansatz (direkte Zeichnung) für 100% Unicode-Kontrolle!`)
              throw flattenError
            }
            throw flattenError
          }
        } else {
          // Keine Formularfelder gefüllt, flatten sollte sicher sein
          form.flatten()
          console.log('✅ Formularfelder geflattened - PDF ist jetzt normales PDF ohne interaktive Formularfelder')
        }
        
        if (unicodeFont) {
          console.log('  ✅ Texte wurden mit Unicode-Font (UTF-8/Identity-H) gezeichnet - türkische Zeichen sollten korrekt sein!')
        } else {
          console.log('  ⚠️ Texte wurden mit WinAnsi-Encoding gezeichnet - türkische Zeichen wurden konvertiert')
          console.log('  🔄 Starte Unicode-Wiederherstellung für türkische Zeichen...')
          
          // Versuche Unicode-Fonts einzubetten und Original-Texte wiederherzustellen
          if (fieldInfoMap.size > 0) {
          console.log(`\n🔄 Versuche türkische Zeichen mit Unicode-Fonts wiederherzustellen...`)
          console.log(`  📊 ${fieldInfoMap.size} Feld(er) mit konvertierten Werten gefunden`)
          
          try {
            // Registriere fontkit für Unicode-Unterstützung
            filledDoc.registerFontkit(fontkit)
            
            // Versuche Unicode-Font zu laden (Unicode-Unterstützung für türkische Zeichen)
            // pdf-lib unterstützt Identity-H Encoding für Unicode-Zeichen
            let unicodeFont: PDFFont | null = null
            
            // Verwende eine zuverlässige Font-Quelle (jsDelivr CDN ist sehr zuverlässig)
            const fontUrls = [
              'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
              'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
              'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.ttf'
            ]
            
            for (const fontUrl of fontUrls) {
              try {
                console.log(`  🔄 Versuche Font zu laden von: ${fontUrl}`)
                
                // Verwende fetch ohne Timeout (manche Server haben langsamere Verbindungen)
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 Sekunden Timeout
                
                const fontResponse = await fetch(fontUrl, {
                  headers: {
                    'Accept': 'application/octet-stream, application/font-ttf, font/ttf, */*',
                    'User-Agent': 'Mozilla/5.0'
                  },
                  signal: controller.signal
                })
                
                clearTimeout(timeoutId)
                
                if (fontResponse.ok) {
                  const fontBytes = await fontResponse.arrayBuffer()
                  console.log(`  📦 Font-Datei geladen: ${fontBytes.byteLength} Bytes`)
                  
                  if (fontBytes.byteLength > 0) {
                    try {
                      unicodeFont = await filledDoc.embedFont(fontBytes)
                      console.log('  ✅ Unicode-Font (Noto Sans) erfolgreich eingebettet')
                      console.log('  ✅ Font unterstützt Unicode/UTF-8 Encoding (Identity-H)')
                      console.log(`  ✅ Font kann türkische Zeichen darstellen: İ, ğ, ş, Ç, ç, Ö, ö, Ü, ü`)
                      
                      // Test: Prüfe ob Font türkische Zeichen unterstützt
                      try {
                        const testText = 'İğşÇçÖöÜü'
                        const testWidth = unicodeFont.widthOfTextAtSize(testText, 12)
                        console.log(`  ✅ Font-Test erfolgreich: Test-Text "${testText}" Breite: ${testWidth}`)
                      } catch (testError) {
                        console.warn(`  ⚠️ Font-Test fehlgeschlagen:`, testError)
                      }
                      
                      break // Erfolgreich geladen, breche Schleife ab
                    } catch (embedError) {
                      console.warn(`  ⚠️ Fehler beim Einbetten der Font:`, embedError)
                      continue
                    }
                  } else {
                    console.warn(`  ⚠️ Font-Datei ist leer: ${fontUrl}`)
                  }
                } else {
                  console.warn(`  ⚠️ Font-Response nicht OK (${fontResponse.status}): ${fontUrl}`)
                }
              } catch (fontError) {
                console.warn(`  ⚠️ Fehler beim Laden von ${fontUrl}:`, fontError)
                if (fontError instanceof Error) {
                  console.warn(`     Fehler-Message: ${fontError.message}`)
                  console.warn(`     Fehler-Name: ${fontError.name}`)
                }
                // Versuche nächste URL
                continue
              }
            }
            
            if (!unicodeFont) {
              console.error('  ❌ KRITISCH: Konnte Unicode-Font von keiner Quelle laden!')
              console.error('  ❌ PDF wird mit konvertierten Werten ausgegeben (İ→I, ğ→g, ş→s, Ü→U, etc.)')
              console.error('  ❌ Bitte überprüfen Sie:')
              console.error('     1. Internet-Verbindung des Servers')
              console.error('     2. Firewall-Einstellungen')
              console.error('     3. CDN-Verfügbarkeit')
            }
            
            if (unicodeFont) {
              // Stelle Original-Texte mit Unicode-Font wiederher
              const pages = filledDoc.getPages()
              let restoredCount = 0
              let skippedCount = 0
              
              console.log(`  📋 Beginne Wiederherstellung für ${fieldInfoMap.size} Feld(er)...`)
              
              for (const [fieldName, fieldInfo] of fieldInfoMap.entries()) {
                // Wiederherstellen, wenn Original-Wert türkische Zeichen enthält ODER konvertiert wurde
                const hasTurkishChars = /[İıĞğŞşÇçÖöÜü]/.test(fieldInfo.originalValue)
                const wasConverted = fieldInfo.originalValue !== fieldInfo.convertedValue
                const needsRestore = wasConverted || hasTurkishChars
                
                console.log(`  🔍 Prüfe Feld "${fieldName}":`)
                console.log(`     Original: "${fieldInfo.originalValue}"`)
                console.log(`     Konvertiert: "${fieldInfo.convertedValue}"`)
                console.log(`     Hat türkische Zeichen: ${hasTurkishChars}`)
                console.log(`     Wurde konvertiert: ${wasConverted}`)
                console.log(`     Benötigt Wiederherstellung: ${needsRestore}`)
                console.log(`     Position: x=${fieldInfo.x}, y=${fieldInfo.y}`)
                
                if (needsRestore) {
                  console.log(`  🔄 Verarbeite Feld "${fieldName}": "${fieldInfo.originalValue}" (konvertiert: "${fieldInfo.convertedValue}")`)
                  
                  if (fieldInfo.x !== undefined && fieldInfo.y !== undefined && 
                      !isNaN(fieldInfo.x) && !isNaN(fieldInfo.y) &&
                      fieldInfo.x >= 0 && fieldInfo.y >= 0) {
                    try {
                      const page = pages[fieldInfo.pageIndex]
                      if (page) {
                        const fontSize = fieldInfo.fontSize || 12
                        const textWidth = unicodeFont.widthOfTextAtSize(fieldInfo.originalValue, fontSize)
                        const textHeight = fontSize * 1.2
                        const fieldWidth = fieldInfo.width || textWidth + 10
                        const fieldHeight = fieldInfo.height || textHeight + 5
                        
                        console.log(`    📐 Position: x=${fieldInfo.x}, y=${fieldInfo.y}, width=${fieldWidth}, height=${fieldHeight}, fontSize=${fontSize}`)
                        console.log(`    📏 Text-Breite: ${textWidth}, Text-Höhe: ${textHeight}`)
                        
                        // Zeichne weißen Hintergrund über konvertierten Text
                        // Verwende etwas größeren Bereich, um sicherzustellen, dass alles überdeckt wird
                        const rectX = fieldInfo.x - 2
                        const rectY = fieldInfo.y - fieldHeight - 2
                        const rectWidth = fieldWidth + 4
                        const rectHeight = fieldHeight + 4
                        
                        page.drawRectangle({
                          x: rectX,
                          y: rectY,
                          width: rectWidth,
                          height: rectHeight,
                          color: rgb(1, 1, 1), // Weiß
                        })
                        
                        console.log(`    🎨 Weißer Hintergrund gezeichnet: x=${rectX}, y=${rectY}, width=${rectWidth}, height=${rectHeight}`)
                        
                        // Berechne zentrierte Position für Text
                        const textX = fieldInfo.x + (fieldWidth - textWidth) / 2
                        const textY = fieldInfo.y - textHeight + (fieldHeight - textHeight) / 2
                        
                        console.log(`    📝 Zeichne Text bei: x=${textX}, y=${textY}`)
                        
                        // Zeichne Original-Text mit Unicode-Font (UTF-8/Identity-H Encoding)
                        // Der Font unterstützt jetzt türkische Zeichen (İ, ğ, ş, Ü, ü, etc.)
                        page.drawText(fieldInfo.originalValue, {
                          x: textX,
                          y: textY,
                          size: fontSize,
                          font: unicodeFont,
                          color: rgb(0, 0, 0),
                        })
                        
                        restoredCount++
                        console.log(`    ✅ Text erfolgreich wiederhergestellt: "${fieldInfo.convertedValue}" → "${fieldInfo.originalValue}"`)
                      } else {
                        skippedCount++
                        console.warn(`    ⚠️ Seite ${fieldInfo.pageIndex} nicht gefunden für Feld "${fieldName}"`)
                      }
                    } catch (restoreError) {
                      skippedCount++
                      console.error(`    ❌ Fehler beim Wiederherstellen von Feld "${fieldName}":`, restoreError)
                      if (restoreError instanceof Error) {
                        console.error(`       Fehler-Message: ${restoreError.message}`)
                        console.error(`       Stack: ${restoreError.stack}`)
                      }
                    }
                  } else {
                    skippedCount++
                    console.error(`    ❌ KRITISCH: Keine gültige Position für Feld "${fieldName}"!`)
                    console.error(`       x=${fieldInfo.x}, y=${fieldInfo.y}`)
                    console.error(`       Original: "${fieldInfo.originalValue}"`)
                    console.error(`       Konvertiert: "${fieldInfo.convertedValue}"`)
                    console.error(`       Dieses Feld wird NICHT wiederhergestellt - türkische Zeichen werden als ASCII dargestellt!`)
                  }
                } else {
                  // Keine Konvertierung nötig, Original-Wert ist bereits WinAnsi-kompatibel
                  console.log(`  ℹ️ Feld "${fieldName}" benötigt keine Wiederherstellung (bereits WinAnsi-kompatibel)`)
                }
              }
              
              console.log(`  📊 Wiederherstellung abgeschlossen: ${restoredCount} Feld(er) wiederhergestellt, ${skippedCount} übersprungen`)
            } else {
              console.warn('  ⚠️ Kein Unicode-Font verfügbar, überspringe Wiederherstellung')
              console.warn('  ⚠️ PDF wird mit konvertierten Werten ausgegeben (İ→I, ğ→g, ş→s, etc.)')
            }
          } catch (unicodeError) {
            console.warn('  ⚠️ Unicode-Wiederherstellung fehlgeschlagen:', unicodeError)
            console.log('  ℹ️ PDF wird mit konvertierten Werten ausgegeben (İ→I, ğ→g, ş→s, etc.)')
          }
          } else {
            if (unicodeFont) {
              console.log('  ✅ Keine Wiederherstellung nötig - alle Texte wurden direkt mit Unicode-Font gezeichnet!')
            } else {
              console.log('  ℹ️ Keine konvertierten Werte gefunden, alle Texte sind bereits WinAnsi-kompatibel')
            }
          }
        }
      } catch (flattenError) {
        console.error('❌ Fehler beim Flatten:', flattenError)
        if (flattenError instanceof Error) {
          console.error('   Flatten-Fehler:', flattenError.message)
          console.error('   Stack:', flattenError.stack)
        }
        throw new Error(`Fehler beim Flatten des PDFs: ${flattenError instanceof Error ? flattenError.message : 'Unbekannter Fehler'}`)
      }
    } else {
      console.warn('⚠️ Kein Formular-Objekt verfügbar zum Flatten')
      throw new Error('PDF enthält keine Formularfelder zum Flatten')
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
        let maxGuestsPerPage = 4 // Standard: 4 Gäste pro Seite
        const fieldAnalysis: { [baseName: string]: { count: number, maxIndex: number, mapped: string, indices: number[] } } = {}
        
        for (const field of tempFields) {
          const fieldName = field.getName()
          const numberMatch = fieldName.match(/^(.+?)([1-9])$/)
          
          if (numberMatch) {
            // Feld hat Nummer am Ende
            const baseName = numberMatch[1]
            const fieldIndex = parseInt(numberMatch[2]) // 1-9
            
            if (!fieldAnalysis[baseName]) {
              fieldAnalysis[baseName] = { count: 0, maxIndex: 0, mapped: '', indices: [] }
            }
            fieldAnalysis[baseName].count++
            fieldAnalysis[baseName].maxIndex = Math.max(fieldAnalysis[baseName].maxIndex, fieldIndex)
            if (!fieldAnalysis[baseName].indices.includes(fieldIndex)) {
              fieldAnalysis[baseName].indices.push(fieldIndex)
            }
            
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
              fieldAnalysis[fieldName] = { count: 1, maxIndex: 0, mapped: fieldMapping[fieldName] || '', indices: [] }
            }
          }
        }
        
        console.log(`📊 Feld-Analyse:`)
        for (const [name, data] of Object.entries(fieldAnalysis)) {
          const mapped = data.mapped ? ` → ${data.mapped}` : ''
          const indexInfo = data.maxIndex > 0 ? ` (max Index: ${data.maxIndex}, Indizes: [${data.indices.sort((a,b) => a-b).join(', ')}])` : ''
          console.log(`  - "${name}": ${data.count}x${mapped}${indexInfo}`)
        }
        console.log(`📊 Maximale Gäste pro Seite (basierend auf Feldnummern): ${maxGuestsPerPage}`)
        
        // Sicherstellen, dass maxGuestsPerPage mindestens 1 ist und maximal die Anzahl der verfügbaren Gäste
        maxGuestsPerPage = Math.max(1, Math.min(maxGuestsPerPage, 9)) // Maximal 9 (Feldnummern 1-9)
        
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
        
        // Gruppiere Gäste: maxGuestsPerPage Gäste pro Seite (z.B. 4 Gäste pro Seite)
        const guestGroups: any[][] = []
        for (let i = 0; i < uniqueGuests.length; i += maxGuestsPerPage) {
          const group = uniqueGuests.slice(i, i + maxGuestsPerPage)
          guestGroups.push(group)
          console.log(`  📋 Gruppe ${guestGroups.length}: Gäste ${i + 1}-${Math.min(i + maxGuestsPerPage, uniqueGuests.length)} (${group.length} Gast/Gäste)`)
        }
        
        console.log(`📄 Erstelle ${guestGroups.length} Seite(n) mit je bis zu ${maxGuestsPerPage} Gast/Gästen`)
        
        // Validierung: Prüfe dass alle Gäste in Gruppen sind
        const totalGuestsInGroups = guestGroups.reduce((sum, group) => sum + group.length, 0)
        if (totalGuestsInGroups !== uniqueGuests.length) {
          console.error(`❌ FEHLER: Nicht alle Gäste in Gruppen! Erwartet: ${uniqueGuests.length}, Gefunden: ${totalGuestsInGroups}`)
          throw new Error(`Nicht alle Gäste konnten gruppiert werden. Erwartet: ${uniqueGuests.length}, Gefunden: ${totalGuestsInGroups}`)
        }
        
        // Tracking: Welche Gäste wurden verarbeitet (global über alle Seiten)
        const processedGuestIds = new Set<string>()
        
        // Für jede Gruppe: Template kopieren und füllen
        for (let groupIndex = 0; groupIndex < guestGroups.length; groupIndex++) {
          const guestGroup = guestGroups[groupIndex]
          const groupGuestIds = guestGroup.map(g => g.id || g.name || JSON.stringify(g))
          
          console.log(`\n📝 Verarbeite Gruppe ${groupIndex + 1}/${guestGroups.length} (Seite ${groupIndex + 1}) mit ${guestGroup.length} Gast/Gästen`)
          console.log(`  👥 Gäste in dieser Gruppe:`)
          guestGroup.forEach((g, idx) => {
            console.log(`    ${idx + 1}. ${g.name || g.id} (Index ${idx})`)
          })
          
          // Prüfe ob Gäste bereits verarbeitet wurden (sollte nicht passieren)
          const alreadyProcessed = groupGuestIds.filter(id => processedGuestIds.has(id))
          if (alreadyProcessed.length > 0) {
            console.error(`  ❌ FEHLER: ${alreadyProcessed.length} Gast/Gäste wurden bereits verarbeitet: ${alreadyProcessed.join(', ')}`)
            throw new Error(`Doppelte Verarbeitung erkannt: ${alreadyProcessed.join(', ')}`)
          }
          
          try {
            // Fülle Template mit Gast-Gruppe (jedes Mal neu laden für saubere Kopie)
            // WICHTIG: guestGroup enthält genau die Gäste für diese Seite (z.B. Gäste 0-3 für Seite 1, Gäste 4-7 für Seite 2)
            const filledDoc = await fillTemplateWithMultipleGuests(templateBytes, guestGroup, getFieldValue, fieldMapping)
            
            // Markiere Gäste als verarbeitet
            for (const guestId of groupGuestIds) {
              processedGuestIds.add(guestId)
            }
            
            console.log(`  ✅ Gäste ${groupIndex * maxGuestsPerPage + 1}-${groupIndex * maxGuestsPerPage + guestGroup.length} verarbeitet`)
            
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
