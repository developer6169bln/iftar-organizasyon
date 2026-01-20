import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { testGoogleSheetsConnection } from '@/lib/googleSheets'
import { z } from 'zod'

const configSchema = z.object({
  eventId: z.string(),
  spreadsheetId: z.string().optional(),
  sheetName: z.string().optional(),
  enabled: z.boolean().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(), // Mapping: DB-Feld -> Sheet-Spaltenname
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId ist erforderlich' },
        { status: 400 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        googleSheetsId: true,
        googleSheetsSheetName: true,
        googleSheetsEnabled: true,
        googleSheetsLastSync: true,
        googleSheetsColumnMapping: true,
      },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    let columnMapping: Record<string, string> | null = null
    if (event.googleSheetsColumnMapping) {
      try {
        columnMapping = JSON.parse(event.googleSheetsColumnMapping)
      } catch (e) {
        console.error('Fehler beim Parsen des Column Mappings:', e)
      }
    }

    return NextResponse.json({
      spreadsheetId: event.googleSheetsId || '',
      sheetName: event.googleSheetsSheetName || 'Gästeliste',
      enabled: event.googleSheetsEnabled,
      lastSync: event.googleSheetsLastSync,
      columnMapping: columnMapping || {},
    })
  } catch (error) {
    console.error('Google Sheets Config GET Fehler:', error)
    return NextResponse.json(
      { error: 'Konfiguration konnte nicht geladen werden' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = configSchema.parse(body)

    const event = await prisma.event.findUnique({
      where: { id: validatedData.eventId },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    
    if (validatedData.spreadsheetId !== undefined) {
      updateData.googleSheetsId = validatedData.spreadsheetId || null
    }
    if (validatedData.sheetName !== undefined) {
      updateData.googleSheetsSheetName = validatedData.sheetName || 'Gästeliste'
    }
    if (validatedData.enabled !== undefined) {
      updateData.googleSheetsEnabled = validatedData.enabled
    }
    if (validatedData.columnMapping !== undefined) {
      updateData.googleSheetsColumnMapping = validatedData.columnMapping 
        ? JSON.stringify(validatedData.columnMapping) 
        : null
    }

    // Wenn Spreadsheet ID gesetzt wird, teste die Verbindung (optional - Fehler werden nur gewarnt, nicht blockiert)
    if (validatedData.spreadsheetId && validatedData.spreadsheetId !== event.googleSheetsId) {
      const sheetName = validatedData.sheetName || 'Gästeliste'
      try {
        // Prüfe zuerst, ob Google Sheets konfiguriert ist
        if (!process.env.GOOGLE_SERVICE_ACCOUNT && !process.env.GOOGLE_API_KEY) {
          console.warn('Google Sheets API nicht konfiguriert - GOOGLE_SERVICE_ACCOUNT oder GOOGLE_API_KEY fehlt')
          // Erlaube trotzdem das Speichern, damit die Konfiguration gesetzt werden kann
        } else {
          const isConnected = await testGoogleSheetsConnection(validatedData.spreadsheetId, sheetName)
          if (!isConnected) {
            // Warnung loggen, aber nicht blockieren - Benutzer kann später testen
            console.warn('Google Sheets Verbindungstest fehlgeschlagen für:', validatedData.spreadsheetId)
            // Erlaube trotzdem das Speichern - der Benutzer kann die Verbindung später testen
          }
        }
      } catch (error) {
        // Logge den Fehler, aber blockiere nicht das Speichern
        console.error('Fehler beim Testen der Google Sheets Verbindung:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
        // Erlaube das Speichern trotzdem, aber füge eine Warnung hinzu
        console.warn('Konfiguration wird trotz Verbindungsfehler gespeichert:', errorMessage)
      }
    }

    const updated = await prisma.event.update({
      where: { id: validatedData.eventId },
      data: updateData,
    })

    let columnMapping: Record<string, string> | null = null
    if (updated.googleSheetsColumnMapping) {
      try {
        columnMapping = JSON.parse(updated.googleSheetsColumnMapping)
      } catch (e) {
        console.error('Fehler beim Parsen des Column Mappings:', e)
      }
    }

    // Prüfe nach dem Speichern, ob die Verbindung funktioniert (optional)
    let connectionWarning: string | null = null
    if (updated.googleSheetsId) {
      try {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT && !process.env.GOOGLE_API_KEY) {
          connectionWarning = 'Google Sheets API nicht konfiguriert. Setze GOOGLE_SERVICE_ACCOUNT oder GOOGLE_API_KEY in den Umgebungsvariablen.'
        } else {
          const sheetName = updated.googleSheetsSheetName || 'Gästeliste'
          const isConnected = await testGoogleSheetsConnection(updated.googleSheetsId, sheetName)
          if (!isConnected) {
            connectionWarning = 'Verbindung zu Google Sheets fehlgeschlagen. Prüfe die Spreadsheet ID, Sheet-Name und Berechtigungen. Die Konfiguration wurde trotzdem gespeichert.'
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
        connectionWarning = `Verbindungstest fehlgeschlagen: ${errorMessage}. Die Konfiguration wurde trotzdem gespeichert.`
      }
    }

    return NextResponse.json({
      success: true,
      event: {
        googleSheetsId: updated.googleSheetsId,
        googleSheetsSheetName: updated.googleSheetsSheetName,
        googleSheetsEnabled: updated.googleSheetsEnabled,
        columnMapping,
      },
      warning: connectionWarning,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('Google Sheets Config Fehler:', error)
    return NextResponse.json(
      { error: 'Konfiguration konnte nicht gespeichert werden' },
      { status: 500 }
    )
  }
}
