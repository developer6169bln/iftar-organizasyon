import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Starte Extraktion der Formularfelder aus PDF...')
    
    const formData = await request.formData()
    const templateFile = formData.get('template') as File | null

    if (!templateFile) {
      return NextResponse.json(
        { error: 'Keine PDF-Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (templateFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Datei muss ein PDF sein' },
        { status: 400 }
      )
    }

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
      console.error('Fehler beim Extrahieren der Formularfelder:', e)
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
