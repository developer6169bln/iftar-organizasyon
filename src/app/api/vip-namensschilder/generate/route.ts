import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFImage } from 'pdf-lib'

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
  helveticaBoldFont: any
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

  // Text-Inhalte
  const textStartY = y + height - 40
  let currentY = textStartY

  // Anreden (falls vorhanden)
  const anrede1 = getFieldValue(guest, 'Anrede 1')
  const anrede2 = getFieldValue(guest, 'Anrede 2')
  const anrede3 = getFieldValue(guest, 'Anrede 3')
  const anrede4 = getFieldValue(guest, 'Anrede 4')
  
  const anreden = [anrede1, anrede2, anrede3, anrede4]
    .filter(a => a && a.trim() !== '')
    .join(' ')

  // Name
  const vorname = getFieldValue(guest, 'Vorname')
  const nachname = getFieldValue(guest, 'Name')
  const fullName = [vorname, nachname].filter(n => n && n.trim() !== '').join(' ')

  // Staat/Institution
  const institution = getFieldValue(guest, 'Staat/Institution') || 
                     getFieldValue(guest, 'Staat / Institution') || ''

  // Tisch-Nummer
  const tischNummer = getFieldValue(guest, 'Tisch-Nummer') || 
                      getFieldValue(guest, 'Tischnummer') || ''

  // Zeichne Text
  const fontSize = 10
  const titleFontSize = 14
  const lineHeight = 16

  // Anreden (kleiner, oben)
  if (anreden) {
    const anredeWidth = helveticaFont.widthOfTextAtSize(anreden, fontSize - 2)
    page.drawText(anreden, {
      x: x + width / 2 - anredeWidth / 2,
      y: currentY,
      size: fontSize - 2,
      color: rgb(0.4, 0.4, 0.4),
      font: helveticaFont,
    })
    currentY -= lineHeight
  }

  // Name (größer, fett)
  if (fullName) {
    const nameWidth = helveticaBoldFont.widthOfTextAtSize(fullName, titleFontSize)
    page.drawText(fullName, {
      x: x + width / 2 - nameWidth / 2,
      y: currentY,
      size: titleFontSize,
      color: rgb(0, 0, 0),
      font: helveticaBoldFont,
    })
    currentY -= lineHeight + 5
  }

  // Institution (falls vorhanden)
  if (institution) {
    const instWidth = helveticaFont.widthOfTextAtSize(institution, fontSize - 1)
    page.drawText(institution, {
      x: x + width / 2 - instWidth / 2,
      y: currentY,
      size: fontSize - 1,
      color: rgb(0.3, 0.3, 0.3),
      font: helveticaFont,
    })
    currentY -= lineHeight
  }

  // Tisch-Nummer (unten)
  if (tischNummer) {
    const tischText = `Tisch ${tischNummer}`
    const tischWidth = helveticaFont.widthOfTextAtSize(tischText, fontSize)
    page.drawText(tischText, {
      x: x + width / 2 - tischWidth / 2,
      y: y + 15,
      size: fontSize,
      color: rgb(0.5, 0.5, 0.5),
      font: helveticaFont,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const guestsJson = formData.get('guests') as string
    const countStr = formData.get('count') as string
    const logoFile = formData.get('logo') as File | null

    if (!guestsJson) {
      return NextResponse.json(
        { error: 'Keine Gäste-Daten gefunden' },
        { status: 400 }
      )
    }

    const guests = JSON.parse(guestsJson)
    const namensschildCount = parseInt(countStr || '4', 10)

    if (!Array.isArray(guests) || guests.length === 0) {
      return NextResponse.json(
        { error: 'Keine Gäste zum Generieren gefunden' },
        { status: 400 }
      )
    }

    // Erstelle PDF-Dokument
    const pdfDoc = await PDFDocument.create()

    // Fonts einbetten (einmal für alle Seiten)
    const helveticaFont = await pdfDoc.embedFont('Helvetica')
    const helveticaBoldFont = await pdfDoc.embedFont('Helvetica-Bold')

    // Logo einbetten (falls vorhanden)
    let logoImage: PDFImage | undefined
    if (logoFile) {
      try {
        const logoBytes = await logoFile.arrayBuffer()
        const logoImageData = await pdfDoc.embedPng(logoBytes).catch(async () => {
          // Falls PNG fehlschlägt, versuche JPG
          return await pdfDoc.embedJpg(logoBytes)
        })
        logoImage = logoImageData
      } catch (e) {
        console.error('Fehler beim Einbetten des Logos:', e)
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
    let guestIndex = 0
    let currentPage = 0

    while (guestIndex < guests.length) {
      // Neue Seite für jede Gruppe
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      
      // Platziere Namensschilder auf der Seite
      for (let row = 0; row < rows && guestIndex < guests.length; row++) {
        for (let col = 0; col < cols && guestIndex < guests.length; col++) {
          const x = margin + col * (namensschildWidth + spacing)
          const y = A4_HEIGHT - margin - (row + 1) * namensschildHeight + row * spacing

          await drawNamensschild(
            page,
            guests[guestIndex],
            x,
            y,
            namensschildWidth,
            namensschildHeight,
            logoImage,
            helveticaFont,
            helveticaBoldFont
          )

          guestIndex++
        }
      }

      currentPage++
    }

    // PDF generieren
    const pdfBytes = await pdfDoc.save()

    return new NextResponse(pdfBytes as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="namensschilder.pdf"`,
      },
    })
  } catch (error) {
    console.error('Fehler beim Generieren der Namensschilder:', error)
    return NextResponse.json(
      { 
        error: 'Fehler beim Generieren der Namensschilder',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    )
  }
}
