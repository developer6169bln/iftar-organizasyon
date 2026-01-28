import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Starte Extraktion der Felder aus Template (PDF oder DOCX)...')
    
    const formData = await request.formData()
    const templateFile = formData.get('template') as File | null

    if (!templateFile) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    const contentType = templateFile.type
    const fileName = (templateFile as any).name || 'template'

    // === FALL 1: PDF (wie bisher) ===
    const isPdf =
      contentType === 'application/pdf' ||
      fileName.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      console.log('📄 Template-Typ: PDF – extrahiere Formularfelder…')

      // Lade PDF
      const templateBytes = await templateFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(templateBytes)
      
      // Extrahiere Formularfelder
      const fields: Array<{ name: string; type: string }> = []
      
      try {
        const form = pdfDoc.getForm()
        const formFields = form.getFields()
        
        console.log(`🔍 Gefundene Formularfelder: ${formFields.length}`)
        
        for (const field of formFields) {
          const fieldName = field.getName()
          const fieldType = field.constructor.name
          
          fields.push({
            name: fieldName,
            type: fieldType.replace('PDF', ''), // z.B. "TextField", "CheckBox", etc.
          })
          
          console.log(`  - ${fieldName} (${fieldType})`)
        }
        
        if (fields.length === 0) {
          return NextResponse.json(
            { 
              error: 'Keine Formularfelder im PDF gefunden',
              fields: [],
              message: 'Das PDF enthält keine Formularfelder. Bitte erstellen Sie ein PDF mit Formularfeldern (z.B. mit Adobe Acrobat).'
            },
            { status: 200 }
          )
        }
        
        return NextResponse.json({
          success: true,
          fields,
          message: `${fields.length} Formularfeld(er) gefunden`
        })
      } catch (e) {
        console.error('Fehler beim Extrahieren der Formularfelder aus PDF:', e)
        return NextResponse.json(
          { 
            error: 'Fehler beim Extrahieren der Formularfelder',
            fields: [],
            details: e instanceof Error ? e.message : 'Unbekannter Fehler',
            message: 'Das PDF könnte keine Formularfelder enthalten oder ist beschädigt.'
          },
          { status: 200 }
        )
      }
    }

    // === FALL 2: Word-Dokument (DOCX) – Platzhalter {{...}} extrahieren ===
    const isDocx =
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.toLowerCase().endsWith('.docx')

    if (isDocx) {
      console.log('📄 Template-Typ: DOCX – extrahiere Platzhalter {{...}}…')

      try {
        const templateBytes = await templateFile.arrayBuffer()
        const zip = await JSZip.loadAsync(templateBytes)

        const docFile = zip.file('word/document.xml')
        if (!docFile) {
          return NextResponse.json(
            { 
              error: 'DOCX enthält keine word/document.xml',
              fields: [],
              message: 'Die Word-Vorlage scheint ungültig zu sein.'
            },
            { status: 200 }
          )
        }

        const documentXml = await docFile.async('string')

        // Suche nach {{PLATZHALTER}} Mustern
        const placeholderSet = new Set<string>()
        const regex = /\{\{([^}]+)\}\}/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(documentXml)) !== null) {
          const name = match[1].trim()
          if (name) {
            placeholderSet.add(name)
          }
        }

        const fields = Array.from(placeholderSet).map((name) => ({
          name,
          type: 'Text', // einfach als Text-Platzhalter behandeln
        }))

        if (fields.length === 0) {
          return NextResponse.json(
            {
              error: 'Keine Platzhalter im DOCX gefunden',
              fields: [],
              message: 'Im Word-Dokument wurden keine {{PLATZHALTER}} gefunden. Bitte verwenden Sie z.B. {{NAME}}, {{VORNAME}}, {{STAAT_INSTITUTION}}.',
            },
            { status: 200 }
          )
        }

        console.log(`🔍 Gefundene Platzhalter in DOCX: ${fields.length}`)
        fields.forEach(f => console.log(`  - {{${f.name}}}`))

        return NextResponse.json({
          success: true,
          fields,
          message: `${fields.length} Platzhalter in DOCX gefunden`
        })
      } catch (e) {
        console.error('Fehler beim Extrahieren der Platzhalter aus DOCX:', e)
        return NextResponse.json(
          {
            error: 'Fehler beim Extrahieren der Platzhalter aus DOCX',
            fields: [],
            details: e instanceof Error ? e.message : 'Unbekannter Fehler',
            message: 'Die Word-Vorlage konnte nicht gelesen werden.',
          },
          { status: 200 }
        )
      }
    }

    // Anderer Dateityp
    return NextResponse.json(
      { 
        error: 'Datei muss ein PDF oder eine Word-Datei (DOCX) sein',
        fields: [],
        message: 'Unterstützte Formate: PDF (mit Formularfeldern) oder DOCX (mit {{PLATZHALTERN}}).'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Fehler beim Verarbeiten des PDFs:', error)
    return NextResponse.json(
      { 
        error: 'Fehler beim Verarbeiten des PDFs',
        fields: [],
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    )
  }
}
