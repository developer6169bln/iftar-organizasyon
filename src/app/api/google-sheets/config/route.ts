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

    // Wenn Spreadsheet ID gesetzt wird, teste die Verbindung
    if (validatedData.spreadsheetId && validatedData.spreadsheetId !== event.googleSheetsId) {
      const sheetName = validatedData.sheetName || 'Gästeliste'
      try {
        const isConnected = await testGoogleSheetsConnection(validatedData.spreadsheetId, sheetName)
        if (!isConnected) {
          return NextResponse.json(
            { error: 'Verbindung zu Google Sheets fehlgeschlagen. Prüfe die Spreadsheet ID und Berechtigungen.' },
            { status: 400 }
          )
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Fehler beim Testen der Google Sheets Verbindung', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
          { status: 400 }
        )
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

    return NextResponse.json({
      success: true,
      event: {
        googleSheetsId: updated.googleSheetsId,
        googleSheetsSheetName: updated.googleSheetsSheetName,
        googleSheetsEnabled: updated.googleSheetsEnabled,
        columnMapping,
      },
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
