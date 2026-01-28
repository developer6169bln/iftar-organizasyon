import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const maxDuration = 60

// Hilfsfunktion: XML escapen
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Hilfsfunktion: Regex-Sonderzeichen escapen
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Feldwerte wie in der PDF-Route ableiten (vereinfachte Variante)
function getFieldValue(guest: any, fieldName: string): string {
  if (!guest) return ''

  // additionalData prüfen
  if (guest.additionalData) {
    try {
      const additional = JSON.parse(guest.additionalData)
      if (Object.prototype.hasOwnProperty.call(additional, fieldName)) {
        const v = additional[fieldName]
        if (v !== null && v !== undefined) return String(v)
      }
    } catch {
      // Ignorieren, Fallbacks nutzen
    }
  }

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
    if (guest.organization && String(guest.organization).trim() !== '') {
      return String(guest.organization)
    }
    if (guest.additionalData) {
      try {
        const additional = JSON.parse(guest.additionalData)
        const keys = [
          'Staat/Institution',
          'Staat / Institution',
          'StaatInstitution',
          'Staat_Institution',
          'Institution',
          'Staat',
          'Organisation',
          'Organization',
          'Partei / Organisation / Unternehmen',
          'Partei/Organisation/Unternehmen',
        ]
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(additional, key)) {
            const v = additional[key]
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              return String(v)
            }
          }
        }
      } catch {
        // Ignorieren
      }
    }
    return ''
  }

  return ''
}

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Starte DOCX-Generierung für Namensschilder...')

    const formData = await request.formData()
    const guestsJson = formData.get('guests') as string | null
    const templateFile = formData.get('template') as File | null
    const fieldMappingJson = formData.get('fieldMapping') as string | null

    if (!guestsJson) {
      return NextResponse.json({ error: 'Keine Gäste-Daten gefunden' }, { status: 400 })
    }
    if (!templateFile) {
      return NextResponse.json({ error: 'Keine DOCX-Vorlage gefunden' }, { status: 400 })
    }

    const fileName = templateFile.name.toLowerCase()
    const contentType = templateFile.type
    const isDocx =
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')

    if (!isDocx) {
      return NextResponse.json(
        { error: 'Vorlage ist keine DOCX-Datei. Für DOCX-Ausgabe wird eine Word-Vorlage benötigt.' },
        { status: 400 }
      )
    }

    let guests: any[] = []
    try {
      const parsed = JSON.parse(guestsJson)
      if (Array.isArray(parsed)) {
        guests = parsed
      }
    } catch (e) {
      console.error('❌ Fehler beim Parsen der Gäste-Daten (DOCX):', e)
      return NextResponse.json({ error: 'Ungültige Gäste-Daten' }, { status: 400 })
    }

    if (guests.length === 0) {
      return NextResponse.json({ error: 'Keine Gäste zum Generieren gefunden' }, { status: 400 })
    }

    let fieldMapping: { [placeholder: string]: string } = {}
    if (fieldMappingJson) {
      try {
        fieldMapping = JSON.parse(fieldMappingJson)
      } catch (e) {
        console.error('❌ Fehler beim Parsen des Field-Mappings (DOCX):', e)
      }
    }

    const templateBytes = await templateFile.arrayBuffer()
    const zip = await JSZip.loadAsync(templateBytes)
    const docFile = zip.file('word/document.xml')

    if (!docFile) {
      return NextResponse.json(
        { error: 'Konnte word/document.xml in der DOCX-Vorlage nicht finden' },
        { status: 400 }
      )
    }

    const documentXml = await docFile.async('string')

    const bodyStartTag = '<w:body>'
    const bodyEndTag = '</w:body>'
    const startIdx = documentXml.indexOf(bodyStartTag)
    const endIdx = documentXml.lastIndexOf(bodyEndTag)

    if (startIdx === -1 || endIdx === -1) {
      console.warn('⚠️ Konnte <w:body> nicht zuverlässig finden, verwende gesamtes Dokument für Ersetzung')
    }

    const beforeBody =
      startIdx !== -1 ? documentXml.slice(0, startIdx + bodyStartTag.length) : ''
    const bodyTemplate =
      startIdx !== -1 && endIdx !== -1
        ? documentXml.slice(startIdx + bodyStartTag.length, endIdx)
        : documentXml
    const afterBody = endIdx !== -1 ? documentXml.slice(endIdx) : ''

    // Erzeugt den XML-Inhalt für einen Gast auf Basis des Body-Templates
    const renderGuestBody = (body: string, guest: any): string => {
      let result = body

      for (const [placeholder, mappedField] of Object.entries(fieldMapping)) {
        if (!mappedField) continue

        let value = ''
        if (mappedField === 'Name') {
          const vorname = getFieldValue(guest, 'Vorname')
          const nachname = getFieldValue(guest, 'Name')
          value = [vorname, nachname].filter((x) => x && x.trim() !== '').join(' ')
        } else {
          value = getFieldValue(guest, mappedField)
        }

        const xmlValue = escapeXml(value || '')
        const pattern = new RegExp('\\{\\{\\s*' + escapeRegExp(placeholder) + '\\s*\\}\\}', 'g')
        result = result.replace(pattern, xmlValue)
      }

      return result
    }

    // Für jeden Gast einen eigenen Body-Block mit Seitenumbruch dazwischen
    const pageBreak =
      '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

    const guestBodies: string[] = []
    guests.forEach((guest, index) => {
      console.log(`📝 Erzeuge DOCX-Inhalt für Gast ${index + 1}/${guests.length}: ${guest.name || guest.id}`)
      const bodyXml = renderGuestBody(bodyTemplate, guest)
      guestBodies.push(bodyXml)
    })

    const combinedBody =
      beforeBody +
      guestBodies.join(pageBreak) +
      afterBody

    zip.file('word/document.xml', combinedBody)

    const outBytes = await zip.generateAsync({ type: 'nodebuffer' })

    console.log(`✅ DOCX erfolgreich generiert (${outBytes.byteLength} Bytes)`)

    return new NextResponse(outBytes as any, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="namensschilder-${new Date()
          .toISOString()
          .split('T')[0]}.docx"`,
      },
    })
  } catch (error) {
    console.error('❌ Fehler beim Generieren der DOCX-Namensschilder:', error)
    return NextResponse.json(
      {
        error: 'Fehler beim Generieren der DOCX-Namensschilder',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    )
  }
}

