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

// Feldwerte wie in der PDF-Route ableiten (vollständige Variante)
function getFieldValue(guest: any, fieldName: string): string {
  if (!guest) return ''

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

    // Finde alle Platzhalter im Template (z.B. {{NAME1}}, {{NAME2}}, {{VORNAME1}}, etc.)
    const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g
    const allPlaceholders = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = placeholderRegex.exec(bodyTemplate)) !== null) {
      const placeholder = match[1].trim()
      if (placeholder) {
        allPlaceholders.add(placeholder)
      }
    }

    console.log(`📋 Gefundene Platzhalter im Template:`, Array.from(allPlaceholders))

    // Gruppiere Platzhalter nach Basisnamen (ohne Nummer am Ende)
    // z.B. "NAME1", "NAME2" → Basisname "NAME"
    const placeholdersByBaseName: {
      [baseName: string]: { placeholders: string[]; indices: number[] }
    } = {}

    for (const placeholder of allPlaceholders) {
      // Prüfe ob Platzhalter mit Nummer endet (1-9)
      const numberMatch = placeholder.match(/^(.+?)([1-9])$/i)

      if (numberMatch) {
        // Platzhalter hat Nummer am Ende (z.B. "NAME1", "VORNAME2")
        const baseName = numberMatch[1].toUpperCase() // z.B. "NAME"
        const fieldIndex = parseInt(numberMatch[2]) - 1 // 0-basiert (1→0, 2→1, etc.)

        if (!placeholdersByBaseName[baseName]) {
          placeholdersByBaseName[baseName] = { placeholders: [], indices: [] }
        }
        placeholdersByBaseName[baseName].placeholders.push(placeholder)
        placeholdersByBaseName[baseName].indices.push(fieldIndex)

        console.log(
          `  📋 Platzhalter "${placeholder}" → Basisname "${baseName}", Index ${fieldIndex}`
        )
      } else {
        // Platzhalter hat keine Nummer, behandle als einzelnes Feld
        const baseName = placeholder.toUpperCase()
        if (!placeholdersByBaseName[baseName]) {
          placeholdersByBaseName[baseName] = { placeholders: [], indices: [] }
        }
        placeholdersByBaseName[baseName].placeholders.push(placeholder)
        placeholdersByBaseName[baseName].indices.push(0) // Standard-Index 0
      }
    }

    console.log(
      `📊 Platzhalter-Gruppierung: ${Object.keys(placeholdersByBaseName).length} verschiedene Basisnamen`
    )
    for (const [baseName, data] of Object.entries(placeholdersByBaseName)) {
      console.log(
        `  - "${baseName}": ${data.placeholders.length} Platzhalter, Indizes: [${data.indices.join(', ')}]`
      )
    }

    // Bestimme maximale Anzahl Gäste pro Seite basierend auf höchstem Index
    let maxGuestsPerPage = 1
    for (const [baseName, data] of Object.entries(placeholdersByBaseName)) {
      // Prüfe ob dieser Basisname zugeordnet ist
      const isMapped =
        fieldMapping[baseName] ||
        data.placeholders.some((p) => fieldMapping[p]) ||
        data.placeholders.some((p) => {
          // Prüfe auch Varianten (z.B. "NAME" → "Name")
          const variants = [p, p.toUpperCase(), p.toLowerCase()]
          return variants.some((v) => fieldMapping[v])
        })

      if (isMapped) {
        const maxIndex = Math.max(...data.indices, 0)
        maxGuestsPerPage = Math.max(maxGuestsPerPage, maxIndex + 1) // +1 weil 0-basiert
      }
    }

    console.log(
      `📊 Maximale Gäste pro Seite (basierend auf Platzhalter-Indizes): ${maxGuestsPerPage}`
    )

    // Gruppiere Gäste: maxGuestsPerPage Gäste pro Seite
    const guestGroups: any[][] = []
    for (let i = 0; i < guests.length; i += maxGuestsPerPage) {
      const group = guests.slice(i, i + maxGuestsPerPage)
      guestGroups.push(group)
      console.log(
        `  📋 Gruppe ${guestGroups.length}: Gäste ${i + 1}-${Math.min(i + maxGuestsPerPage, guests.length)} (${group.length} Gast/Gäste)`
      )
    }

    console.log(
      `📄 Erstelle ${guestGroups.length} Seite(n) mit je bis zu ${maxGuestsPerPage} Gast/Gästen`
    )

    // Erzeugt den XML-Inhalt für eine Gast-Gruppe (mehrere Gäste auf einer Seite)
    const renderGuestGroupBody = (body: string, guestGroup: any[]): string => {
      let result = body

      // Für jeden Platzhalter im Template
      for (const [baseName, data] of Object.entries(placeholdersByBaseName)) {
        for (let i = 0; i < data.placeholders.length; i++) {
          const placeholder = data.placeholders[i]
          const fieldIndex = data.indices[i] // 0-basiert (0 = erster Gast, 1 = zweiter Gast, etc.)

          // Finde zugeordnetes Gast-Feld (case-insensitive)
          let mappedField = fieldMapping[placeholder]
          if (!mappedField) {
            // Prüfe Basisname
            mappedField = fieldMapping[baseName]
          }
          if (!mappedField) {
            // Prüfe Varianten (case-insensitive)
            const placeholderUpper = placeholder.toUpperCase()
            const placeholderLower = placeholder.toLowerCase()
            const baseNameUpper = baseName.toUpperCase()
            const baseNameLower = baseName.toLowerCase()
            
            // Suche in fieldMapping (case-insensitive)
            for (const [key, value] of Object.entries(fieldMapping)) {
              const keyUpper = key.toUpperCase()
              if (
                keyUpper === placeholderUpper ||
                keyUpper === baseNameUpper ||
                keyUpper === placeholderLower ||
                keyUpper === baseNameLower
              ) {
                mappedField = value
                break
              }
            }
          }

          if (!mappedField) {
            console.log(`  ⏭️ Platzhalter "${placeholder}" nicht zugeordnet, überspringe`)
            continue
          }

          // Hole Gast für diesen Index
          const guest = guestGroup[fieldIndex]
          if (!guest) {
            console.log(
              `  ⏭️ Kein Gast für Index ${fieldIndex} (Platzhalter "${placeholder}"), überspringe`
            )
            // Ersetze mit leerem String
            const pattern = new RegExp(
              '\\{\\{\\s*' + escapeRegExp(placeholder) + '\\s*\\}\\}',
              'gi'
            )
            result = result.replace(pattern, '')
            continue
          }

          // Hole Wert aus Gast-Daten
          let value = ''
          if (mappedField === 'Name') {
            const vorname = getFieldValue(guest, 'Vorname')
            const nachname = getFieldValue(guest, 'Name')
            value = [vorname, nachname].filter((x) => x && x.trim() !== '').join(' ')
          } else {
            value = getFieldValue(guest, mappedField)
          }

          const xmlValue = escapeXml(value || '')
          const pattern = new RegExp(
            '\\{\\{\\s*' + escapeRegExp(placeholder) + '\\s*\\}\\}',
            'gi'
          )
          result = result.replace(pattern, xmlValue)

          console.log(
            `  ✅ Platzhalter "${placeholder}" (Index ${fieldIndex}) → Gast: ${guest.name || guest.id}, Wert: "${value}"`
          )
        }
      }

      return result
    }

    // Für jede Gast-Gruppe eine Seite erstellen
    const pageBreak =
      '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

    const groupBodies: string[] = []
    guestGroups.forEach((group, groupIndex) => {
      console.log(
        `📝 Erzeuge DOCX-Inhalt für Gruppe ${groupIndex + 1}/${guestGroups.length} (${group.length} Gast/Gäste)`
      )
      const bodyXml = renderGuestGroupBody(bodyTemplate, group)
      groupBodies.push(bodyXml)
    })

    const combinedBody = beforeBody + groupBodies.join(pageBreak) + afterBody

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

