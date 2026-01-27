import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFImage, degrees, PDFPage, PDFFont } from 'pdf-lib'

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

// Hilfsfunktion: Fülle PDF-Template mit Gast-Daten
async function fillTemplateWithGuestData(
  templateBytes: ArrayBuffer,
  guest: any,
  getFieldValue: (guest: any, fieldName: string) => string
): Promise<PDFDocument> {
  // Lade Template
  const filledDoc = await PDFDocument.load(templateBytes)
  
  // Gast-Daten extrahieren
  const vorname = getFieldValue(guest, 'Vorname')
  const nachname = getFieldValue(guest, 'Name')
  const name = [vorname, nachname].filter(n => n && n.trim() !== '').join(' ')
  const tischNummer = getFieldValue(guest, 'Tisch-Nummer') || getFieldValue(guest, 'Tischnummer') || ''
  const staatInstitution = getFieldValue(guest, 'Staat/Institution') || 
                          getFieldValue(guest, 'Staat / Institution') || ''
  
  // Platzhalter-Mapping
  const placeholders: { [key: string]: string } = {
    'NAME': name,
    'VORNAME': vorname,
    'TISCH-NUMMER': tischNummer,
    'TISCHNUMMER': tischNummer,
    'STAAT/INSTITUTION': staatInstitution,
    'STAAT / INSTITUTION': staatInstitution,
  }
  
  // Versuche zuerst PDF-Formularfelder zu füllen
  try {
    const form = filledDoc.getForm()
    const fields = form.getFields()
    
    console.log(`🔍 Gefundene Formularfelder: ${fields.length}`)
    
    for (const field of fields) {
      const fieldName = field.getName().toUpperCase()
      console.log(`🔍 Prüfe Feld: "${fieldName}"`)
      
      // Prüfe alle Platzhalter-Varianten
      for (const [placeholder, value] of Object.entries(placeholders)) {
        if (fieldName.includes(placeholder) || fieldName === placeholder) {
          try {
            const fieldType = field.constructor.name
            console.log(`📝 Fülle Feld "${fieldName}" (Typ: ${fieldType}) mit: "${value}"`)
            
            if (fieldType === 'PDFTextField') {
              (field as any).setText(value)
            } else if (fieldType === 'PDFCheckBox') {
              // Checkboxen ignorieren
            } else if (fieldType === 'PDFDropdown') {
              (field as any).select(value)
            }
            console.log(`✅ Formularfeld "${fieldName}" gefüllt`)
            break // Nur einmal füllen
          } catch (e) {
            console.warn(`⚠️ Konnte Formularfeld "${fieldName}" nicht füllen:`, e)
          }
        }
      }
    }
    
    // Flatten form (macht Formularfelder zu statischem Text)
    form.flatten()
    console.log('✅ Formularfelder gefüllt und geflattened')
  } catch (e) {
    console.log('ℹ️ Keine PDF-Formularfelder gefunden:', e)
    // Wenn keine Formularfelder vorhanden sind, müssen wir Text-Platzhalter manuell ersetzen
    // Das ist komplexer und erfordert Text-Extraktion und -Ersetzung
    // Für jetzt unterstützen wir nur PDF-Formularfelder
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
    const countStr = formData.get('count') as string
    const settingsJson = formData.get('settings') as string
    const orientationStr = formData.get('orientation') as string
    const logoFile = formData.get('logo') as File | null

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
        
        // Für jeden Gast: Template kopieren und füllen
        for (let i = 0; i < guests.length; i++) {
          const guest = guests[i]
          console.log(`📝 Verarbeite Gast ${i + 1}/${guests.length}: ${guest.name || guest.id}`)
          
          // Fülle Template mit Gast-Daten (jedes Mal neu laden für saubere Kopie)
          const filledDoc = await fillTemplateWithGuestData(templateBytes, guest, getFieldValue)
          
          // Kopiere alle Seiten des gefüllten Templates ins finale Dokument
          const pageCount = filledDoc.getPageCount()
          const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
          const copiedPages = await finalDoc.copyPages(filledDoc, pageIndices)
          
          for (const page of copiedPages) {
            finalDoc.addPage(page)
          }
          
          console.log(`✅ Gast ${i + 1}/${guests.length} verarbeitet (${pageCount} Seite(n))`)
        }
        
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
        console.error('Fehler beim Verarbeiten des Templates:', error)
        if (error instanceof Error) {
          console.error('Fehler-Stack:', error.stack)
        }
        return NextResponse.json(
          { 
            error: 'Fehler beim Verarbeiten des PDF-Templates',
            details: error instanceof Error ? error.message : 'Unbekannter Fehler'
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
