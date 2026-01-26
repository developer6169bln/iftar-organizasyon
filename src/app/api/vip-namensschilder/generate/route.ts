import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFImage, degrees } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 60

// A4-Dimensionen in Punkten (1 Punkt = 1/72 Zoll)
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

// Hilfsfunktion: Hole Feldwert aus Guest
function getFieldValue(guest: any, fieldName: string): string {
  if (guest.additionalData) {
    try {
      const additional = JSON.parse(guest.additionalData)
      if (additional.hasOwnProperty(fieldName)) {
        const value = additional[fieldName]
        return value !== null && value !== undefined ? String(value) : ''
      }
    } catch (e) {
      // Ignoriere Parse-Fehler
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
  settings: any
) {
  // Berechne die Mitte des Namensschilds für die Faltlinie
  const foldLineX = x + width / 2
  
  // Hintergrund-Rahmen
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1), // Weiß
  })

  // Faltlinie in der Mitte (gestrichelt)
  for (let i = 0; i < height; i += 10) {
    page.drawLine({
      start: { x: foldLineX, y: y + i },
      end: { x: foldLineX, y: Math.min(y + i + 5, y + height) },
      color: rgb(0.7, 0.7, 0.7),
      thickness: 0.5,
    })
  }

  // Logo (wenn vorhanden) - oben links
  if (logoImage) {
    const logoSize = 30
    const logoX = x + 10
    const logoY = y + height - logoSize - 10
    
    try {
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
      })
    } catch (e) {
      console.error('Fehler beim Zeichnen des Logos:', e)
    }
  }

  // Hilfsfunktion: Sanitize Text für PDF
  const sanitizeText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
  }

  // Nur: Staat/Institution, Vorname, Name
  
  // Staat/Institution
  const institution = getFieldValue(guest, 'Staat/Institution') || 
                     getFieldValue(guest, 'Staat / Institution') || ''

  // Name
  const vorname = getFieldValue(guest, 'Vorname')
  const nachname = getFieldValue(guest, 'Name')
  const fullName = [vorname, nachname].filter(n => n && n.trim() !== '').join(' ')

  // Institution Text (mit Rotation)
  if (institution && institution.trim()) {
    try {
      const sanitizedInst = sanitizeText(institution)
      if (sanitizedInst) {
        const instSize = settings?.institutionSize || 10
        const instX = x + (settings?.institutionX || 50)
        const instY = y + height - (settings?.institutionY || 50)
        const rotation = settings?.institutionRotation || 0
        
        page.drawText(sanitizedInst, {
          x: instX,
          y: instY,
          size: instSize,
          color: rgb(0, 0, 0),
          font: helveticaFont,
          rotate: rotation !== 0 ? degrees(rotation) : undefined,
        })
      }
    } catch (e) {
      console.error('Fehler beim Zeichnen der Institution:', e)
    }
  }

  // Name Text (mit Rotation)
  if (fullName && fullName.trim()) {
    try {
      const sanitizedName = sanitizeText(fullName)
      if (sanitizedName) {
        const nameSize = settings?.nameSize || 14
        const nameX = x + (settings?.nameX || 50)
        const nameY = y + height - (settings?.nameY || 70)
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

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Starte PDF-Generierung für Namensschilder...')
    
    const formData = await request.formData()
    const guestsJson = formData.get('guests') as string
    const countStr = formData.get('count') as string
    const settingsJson = formData.get('settings') as string
    const logoFile = formData.get('logo') as File | null

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

    console.log(`📄 Generiere PDF für ${guests.length} Gäste mit ${namensschildCount} Namensschildern pro Seite`)

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

    // Berechne Layout basierend auf Anzahl
    let cols = 1
    let rows = namensschildCount

    if (namensschildCount === 2) {
      cols = 1
      rows = 2
    } else if (namensschildCount === 4) {
      cols = 2
      rows = 2
    } else if (namensschildCount === 6) {
      cols = 2
      rows = 3
    } else if (namensschildCount === 8) {
      cols = 2
      rows = 4
    }

    const margin = 20
    const spacing = 10
    const namensschildWidth = (A4_WIDTH - margin * 2 - spacing * (cols - 1)) / cols
    const namensschildHeight = (A4_HEIGHT - margin * 2 - spacing * (rows - 1)) / rows

    // Generiere Namensschilder
    console.log('📄 Generiere Namensschilder...')
    let guestIndex = 0
    let currentPage = 0

    while (guestIndex < guests.length) {
      // Neue Seite für jede Gruppe
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      console.log(`📄 Erstelle Seite ${currentPage + 1}...`)
      
      // Platziere Namensschilder auf der Seite
      for (let row = 0; row < rows && guestIndex < guests.length; row++) {
        for (let col = 0; col < cols && guestIndex < guests.length; col++) {
          const x = margin + col * (namensschildWidth + spacing)
          const y = A4_HEIGHT - margin - (row + 1) * namensschildHeight + row * spacing

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
            settings
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
