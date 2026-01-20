import { google } from 'googleapis'

// Google Sheets API Client initialisieren
// Für Service Account: Erstelle eine Service Account in Google Cloud Console
// und lade die JSON-Datei herunter. Setze GOOGLE_SERVICE_ACCOUNT als JSON-String in .env
// Oder verwende API Key für öffentliche Sheets (nur lesen)

export async function getGoogleSheetsClient() {
  // Option 1: Service Account (für vollständigen Zugriff)
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })
      const authClient = await auth.getClient()
      return google.sheets({ version: 'v4', auth: authClient as any })
    } catch (error) {
      console.error('Google Service Account Fehler:', error)
      throw error
    }
  }

  // Option 2: API Key (nur für öffentliche Sheets, nur lesen)
  if (process.env.GOOGLE_API_KEY) {
    return google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY })
  }

  throw new Error('Google Sheets Konfiguration fehlt. Setze GOOGLE_SERVICE_ACCOUNT oder GOOGLE_API_KEY in .env')
}

// Standard-Feld-Mapping (DB-Feld -> Standard-Spaltenname)
const defaultFieldMapping: Record<string, string> = {
  name: 'Name',
  email: 'E-Mail',
  phone: 'Telefon',
  title: 'Titel',
  organization: 'Organisation',
  tableNumber: 'Tischnummer',
  isVip: 'VIP',
  status: 'Status',
  needsSpecialReception: 'Benötigt Empfang',
  receptionBy: 'Empfang von',
  arrivalDate: 'Anreisedatum',
  notes: 'Notizen',
}

export async function syncGuestsToGoogleSheets(
  spreadsheetId: string,
  sheetName: string,
  guests: any[],
  columnMapping?: Record<string, string> // Mapping: DB-Feld -> Sheet-Spaltenname
): Promise<void> {
  try {
    const sheets = await getGoogleSheetsClient()

    // Verwende Mapping oder Standard
    const mapping = columnMapping || defaultFieldMapping

    // Lese aktuelle Header-Zeile
    let headerResponse
    try {
      headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`,
      })
    } catch (error) {
      // Header existiert noch nicht, erstelle sie
      headerResponse = { data: { values: [] } }
    }

    const existingHeaders = headerResponse.data.values?.[0] || []
    
    // Erstelle Header-Array basierend auf Mapping
    const headers: string[] = []
    const fieldOrder = ['name', 'email', 'phone', 'title', 'organization', 'tableNumber', 'isVip', 'status', 'needsSpecialReception', 'receptionBy', 'arrivalDate', 'notes']
    
    for (const field of fieldOrder) {
      const columnName = mapping[field] || defaultFieldMapping[field]
      if (!headers.includes(columnName)) {
        headers.push(columnName)
      }
    }

    // Füge zusätzliche Spalten hinzu, die bereits im Sheet existieren
    for (const existingHeader of existingHeaders) {
      if (existingHeader && !headers.includes(existingHeader)) {
        headers.push(existingHeader)
      }
    }

    // Setze Header (nur wenn sich geändert hat)
    if (JSON.stringify(existingHeaders) !== JSON.stringify(headers)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      })
    }

    // Lösche alte Daten (außer Header)
    if (guests.length > 0) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A2:Z${guests.length + 10}`,
      })
    }

    // Konvertiere Gäste zu Zeilen basierend auf Mapping
    const rows = guests.map((guest) => {
      const row: any[] = []
      for (const field of fieldOrder) {
        const columnName = mapping[field] || defaultFieldMapping[field]
        const columnIndex = headers.indexOf(columnName)
        
        let value: any = ''
        switch (field) {
          case 'name':
            value = guest.name || ''
            break
          case 'email':
            value = guest.email || ''
            break
          case 'phone':
            value = guest.phone || ''
            break
          case 'title':
            value = guest.title || ''
            break
          case 'organization':
            value = guest.organization || ''
            break
          case 'tableNumber':
            value = guest.tableNumber?.toString() || ''
            break
          case 'isVip':
            value = guest.isVip ? 'Ja' : 'Nein'
            break
          case 'status':
            value = guest.status || 'INVITED'
            break
          case 'needsSpecialReception':
            value = guest.needsSpecialReception ? 'Ja' : 'Nein'
            break
          case 'receptionBy':
            value = guest.receptionBy || ''
            break
          case 'arrivalDate':
            value = guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleString('de-DE') : ''
            break
          case 'notes':
            value = guest.notes || ''
            break
        }
        
        // Stelle sicher, dass die Zeile lang genug ist
        while (row.length <= columnIndex) {
          row.push('')
        }
        row[columnIndex] = value
      }
      return row
    })

    // Füge Daten hinzu
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      })
    }

    console.log(`✅ ${guests.length} Gäste zu Google Sheets synchronisiert`)
  } catch (error) {
    console.error('Google Sheets Sync Fehler:', error)
    throw error
  }
}

export async function getSheetHeaders(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  try {
    const sheets = await getGoogleSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    })
    return response.data.values?.[0] || []
  } catch (error) {
    console.error('Fehler beim Lesen der Header:', error)
    return []
  }
}

export async function syncGuestsFromGoogleSheets(
  spreadsheetId: string,
  sheetName: string,
  columnMapping?: Record<string, string> // Mapping: DB-Feld -> Sheet-Spaltenname
): Promise<any[]> {
  try {
    const sheets = await getGoogleSheetsClient()

    // Verwende Mapping oder Standard
    const mapping = columnMapping || defaultFieldMapping

    // Lese Header-Zeile
    const headers = await getSheetHeaders(spreadsheetId, sheetName)
    if (headers.length === 0) {
      console.warn('Keine Header gefunden im Sheet')
      return []
    }

    // Erstelle Reverse-Mapping: Sheet-Spaltenname -> DB-Feld
    const reverseMapping: Record<string, string> = {}
    for (const [dbField, sheetColumn] of Object.entries(mapping)) {
      reverseMapping[sheetColumn] = dbField
    }

    // Finde Spalten-Indizes
    const columnIndices: Record<string, number> = {}
    for (const [dbField, sheetColumn] of Object.entries(mapping)) {
      const index = headers.findIndex(h => h === sheetColumn)
      if (index >= 0) {
        columnIndices[dbField] = index
      }
    }

    // Lese Daten aus Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Z1000`, // Lese bis zu 1000 Zeilen
    })

    const rows = response.data.values || []
    const guests: any[] = []

    // Parse Zeilen zu Gäste-Objekten basierend auf Mapping
    for (const row of rows) {
      // Prüfe ob mindestens Name vorhanden ist
      const nameIndex = columnIndices['name']
      if (nameIndex === undefined || !row[nameIndex]?.trim()) {
        continue
      }

      const guest: any = {}

      // Mappe alle Felder
      if (columnIndices['name'] !== undefined) {
        guest.name = row[columnIndices['name']]?.trim() || ''
      }
      if (columnIndices['email'] !== undefined) {
        guest.email = row[columnIndices['email']]?.trim() || ''
      }
      if (columnIndices['phone'] !== undefined) {
        guest.phone = row[columnIndices['phone']]?.trim() || ''
      }
      if (columnIndices['title'] !== undefined) {
        guest.title = row[columnIndices['title']]?.trim() || ''
      }
      if (columnIndices['organization'] !== undefined) {
        guest.organization = row[columnIndices['organization']]?.trim() || ''
      }
      if (columnIndices['tableNumber'] !== undefined) {
        const tableValue = row[columnIndices['tableNumber']]?.trim()
        guest.tableNumber = tableValue ? parseInt(tableValue) || null : null
      }
      if (columnIndices['isVip'] !== undefined) {
        const vipValue = row[columnIndices['isVip']]?.toLowerCase() || ''
        guest.isVip = vipValue === 'ja' || vipValue === 'yes' || vipValue === '1' || vipValue === 'true'
      }
      if (columnIndices['status'] !== undefined) {
        guest.status = row[columnIndices['status']]?.trim() || 'INVITED'
      }
      if (columnIndices['needsSpecialReception'] !== undefined) {
        const receptionValue = row[columnIndices['needsSpecialReception']]?.toLowerCase() || ''
        guest.needsSpecialReception = receptionValue === 'ja' || receptionValue === 'yes' || receptionValue === '1' || receptionValue === 'true'
      }
      if (columnIndices['receptionBy'] !== undefined) {
        guest.receptionBy = row[columnIndices['receptionBy']]?.trim() || ''
      }
      if (columnIndices['arrivalDate'] !== undefined) {
        const dateValue = row[columnIndices['arrivalDate']]?.trim()
        if (dateValue) {
          try {
            const date = new Date(dateValue)
            if (!isNaN(date.getTime())) {
              guest.arrivalDate = date
            }
          } catch (e) {
            // Ignoriere ungültige Daten
          }
        }
      }
      if (columnIndices['notes'] !== undefined) {
        guest.notes = row[columnIndices['notes']]?.trim() || ''
      }

      guests.push(guest)
    }

    console.log(`✅ ${guests.length} Gäste aus Google Sheets geladen`)
    return guests
  } catch (error) {
    console.error('Google Sheets Read Fehler:', error)
    throw error
  }
}

export async function testGoogleSheetsConnection(spreadsheetId: string, sheetName: string): Promise<boolean> {
  try {
    const sheets = await getGoogleSheetsClient()
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    })
    return true
  } catch (error) {
    console.error('Google Sheets Verbindungstest fehlgeschlagen:', error)
    return false
  }
}
