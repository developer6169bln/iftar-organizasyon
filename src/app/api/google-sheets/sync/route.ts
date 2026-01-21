import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncGuestsToGoogleSheets, syncGuestsFromGoogleSheets, testGoogleSheetsConnection, getSheetHeaders } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, direction = 'to' } = body // 'to' = DB → Sheets, 'from' = Sheets → DB

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
        { status: 400 }
      )
    }

    // Hole Event mit Google Sheets Konfiguration
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    if (!event.googleSheetsId || !event.googleSheetsEnabled) {
      return NextResponse.json(
        { error: 'Google Sheets ist nicht konfiguriert oder aktiviert' },
        { status: 400 }
      )
    }

    const spreadsheetId = event.googleSheetsId
    const sheetName = event.googleSheetsSheetName || 'Gästeliste'
    
    // Parse Column Mapping
    let columnMapping: Record<string, string> | undefined
    if (event.googleSheetsColumnMapping) {
      try {
        columnMapping = JSON.parse(event.googleSheetsColumnMapping)
      } catch (e) {
        console.error('Fehler beim Parsen des Column Mappings:', e)
      }
    }

    if (direction === 'to') {
      // Synchronisiere von DB zu Google Sheets
      const guests = await prisma.guest.findMany({
        where: { eventId },
        orderBy: { name: 'asc' },
      })

      await syncGuestsToGoogleSheets(spreadsheetId, sheetName, guests, columnMapping)

      // Aktualisiere letzte Synchronisation
      await prisma.event.update({
        where: { id: eventId },
        data: { googleSheetsLastSync: new Date() },
      })

      return NextResponse.json({
        success: true,
        message: `${guests.length} Gäste zu Google Sheets synchronisiert`,
        lastSync: new Date().toISOString(),
      })
    } else if (direction === 'from') {
      // Synchronisiere von Google Sheets zu DB
      const guestsFromSheets = await syncGuestsFromGoogleSheets(spreadsheetId, sheetName, columnMapping)

      // Aktualisiere oder erstelle Gäste
      let created = 0
      let updated = 0

      for (const guestData of guestsFromSheets) {
        // Suche nach existierendem Gast (nach Name und E-Mail)
        const existing = await prisma.guest.findFirst({
          where: {
            eventId,
            name: guestData.name,
            email: guestData.email || undefined,
          },
        })

        if (existing) {
          // Aktualisiere existierenden Gast
          await prisma.guest.update({
            where: { id: existing.id },
            data: {
              ...guestData,
              arrivalDate: guestData.arrivalDate || undefined,
            },
          })
          updated++
        } else {
          // Erstelle neuen Gast
          await prisma.guest.create({
            data: {
              eventId,
              ...guestData,
              arrivalDate: guestData.arrivalDate || undefined,
            },
          })
          created++
        }
      }

      // Aktualisiere letzte Synchronisation
      await prisma.event.update({
        where: { id: eventId },
        data: { googleSheetsLastSync: new Date() },
      })

      return NextResponse.json({
        success: true,
        message: `Synchronisation abgeschlossen: ${created} erstellt, ${updated} aktualisiert`,
        created,
        updated,
        lastSync: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        { error: 'Ungültige Richtung. Verwende "to" oder "from"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Google Sheets Sync Fehler:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: 'Synchronisation fehlgeschlagen', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const action = searchParams.get('action') // 'test' oder 'status'

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
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

    if (action === 'test' && event.googleSheetsId) {
      // Teste Verbindung
      // Verwende Sheet-Namen aus Query-Parameter, falls vorhanden, sonst aus DB
      const sheetNameParam = searchParams.get('sheetName')
      const sheetName = sheetNameParam ? decodeURIComponent(sheetNameParam) : (event.googleSheetsSheetName || 'Gästeliste')
      let isConnected = false
      let connectionError: string | null = null
      let headers: string[] = []
      
      try {
        isConnected = await testGoogleSheetsConnection(event.googleSheetsId, sheetName)
        
        // Wenn verbunden, lese Header
        if (isConnected) {
          try {
            headers = await getSheetHeaders(event.googleSheetsId, sheetName)
          } catch (e) {
            console.error('Fehler beim Lesen der Header:', e)
            connectionError = e instanceof Error ? e.message : 'Fehler beim Lesen der Header'
          }
        }
      } catch (error) {
        // Fehler beim Verbindungstest
        console.error('Google Sheets Verbindungstest Fehler:', error)
        isConnected = false
        connectionError = error instanceof Error ? error.message : 'Unbekannter Fehler beim Verbindungstest'
      }
      
      return NextResponse.json({
        connected: isConnected,
        configured: !!event.googleSheetsId,
        enabled: event.googleSheetsEnabled,
        lastSync: event.googleSheetsLastSync,
        headers,
        error: connectionError,
      })
    }

    // Parse Column Mapping
    let columnMapping: Record<string, string> | null = null
    if (event.googleSheetsColumnMapping) {
      try {
        columnMapping = JSON.parse(event.googleSheetsColumnMapping)
      } catch (e) {
        console.error('Fehler beim Parsen des Column Mappings:', e)
      }
    }

    return NextResponse.json({
      configured: !!event.googleSheetsId,
      enabled: event.googleSheetsEnabled,
      lastSync: event.googleSheetsLastSync,
      spreadsheetId: event.googleSheetsId,
      sheetName: event.googleSheetsSheetName || 'Gästeliste',
      columnMapping,
    })
  } catch (error) {
    console.error('Google Sheets Status Fehler:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Status' },
      { status: 500 }
    )
  }
}
