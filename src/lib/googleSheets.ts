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
  columnMapping?: Record<string, string> // Mapping: DB-Feld -> Sheet-Spaltenname (optional, wird ignoriert bei 1:1 Import)
): Promise<any[]> {
  try {
    const sheets = await getGoogleSheetsClient()

    // Lese Header-Zeile (1:1 übernehmen)
    const headers = await getSheetHeaders(spreadsheetId, sheetName)
    if (headers.length === 0) {
      console.warn('Keine Header gefunden im Sheet')
      return []
    }

    // Lese Daten aus Google Sheets (alle Spalten)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:ZZ1000`, // Lese bis zu 1000 Zeilen, bis Spalte ZZ
    })

    const rows = response.data.values || []
    const guests: any[] = []

    // Standard-DB-Felder (für Rückwärtskompatibilität)
    const standardFields: Record<string, string> = {
      'Name': 'name',
      'name': 'name',
      'E-Mail': 'email',
      'Email': 'email',
      'email': 'email',
      'Telefon': 'phone',
      'Phone': 'phone',
      'phone': 'phone',
      'Titel': 'title',
      'Title': 'title',
      'title': 'title',
      'Organisation': 'organization',
      'Organization': 'organization',
      'organization': 'organization',
      'Tischnummer': 'tableNumber',
      'Table Number': 'tableNumber',
      'tableNumber': 'tableNumber',
      'VIP': 'isVip',
      'vip': 'isVip',
      'Status': 'status',
      'status': 'status',
      'Benötigt Empfang': 'needsSpecialReception',
      'Empfang von': 'receptionBy',
      'Anreisedatum': 'arrivalDate',
      'Notizen': 'notes',
      'notes': 'notes',
    }

    // Finde Spalten-Indizes für Standard-Felder
    const columnIndices: Record<string, number> = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.trim()
      if (header && standardFields[header]) {
        columnIndices[standardFields[header]] = i
      }
    }

    // Parse Zeilen zu Gäste-Objekten (1:1 Import)
    for (const row of rows) {
      // Prüfe ob mindestens Name vorhanden ist
      const nameIndex = columnIndices['name'] ?? headers.findIndex(h => h?.toLowerCase().includes('name'))
      if (nameIndex < 0 || !row[nameIndex]?.trim()) {
        continue
      }

      const guest: any = {}

      // Mappe Standard-Felder (falls vorhanden)
      if (columnIndices['name'] !== undefined) {
        guest.name = row[columnIndices['name']]?.trim() || ''
      } else if (nameIndex >= 0) {
        guest.name = row[nameIndex]?.trim() || ''
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
        guest.isVip = vipValue === 'ja' || vipValue === 'yes' || vipValue === '1' || vipValue === 'true' || vipValue === '★'
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

      // Speichere ALLE Spalten 1:1 in additionalData (inkl. Standard-Felder für Vollständigkeit)
      const additionalData: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.trim()
        if (header) {
          const value = row[i]?.trim() || ''
          additionalData[header] = value
        }
      }
      guest.additionalData = JSON.stringify(additionalData)

      guests.push(guest)
    }

    console.log(`✅ ${guests.length} Gäste aus Google Sheets geladen (1:1 Import mit ${headers.length} Spalten)`)
    return guests
  } catch (error) {
    console.error('Google Sheets Read Fehler:', error)
    throw error
  }
}

export async function testGoogleSheetsConnection(spreadsheetId: string, sheetName: string): Promise<boolean> {
  try {
    // Prüfe zuerst, ob die API konfiguriert ist
    if (!process.env.GOOGLE_SERVICE_ACCOUNT && !process.env.GOOGLE_API_KEY) {
      console.error('Google Sheets API nicht konfiguriert: GOOGLE_SERVICE_ACCOUNT oder GOOGLE_API_KEY fehlt')
      throw new Error('Google Sheets API nicht konfiguriert. Setze GOOGLE_SERVICE_ACCOUNT oder GOOGLE_API_KEY in den Umgebungsvariablen.')
    }

    const sheets = await getGoogleSheetsClient()
    
    // Versuche zuerst, das Spreadsheet zu lesen
    try {
      await sheets.spreadsheets.get({
        spreadsheetId,
      })
    } catch (error: any) {
      if (error?.code === 404) {
        throw new Error(`Spreadsheet mit ID "${spreadsheetId}" nicht gefunden. Prüfe die Spreadsheet ID.`)
      }
      if (error?.code === 403) {
        throw new Error(`Zugriff verweigert. Stelle sicher, dass die Service Account E-Mail Zugriff auf das Spreadsheet hat.`)
      }
      throw error
    }

    // Versuche dann, die Sheet-Tabelle zu lesen
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`,
      })
    } catch (error: any) {
      if (error?.code === 400) {
        throw new Error(`Sheet "${sheetName}" nicht gefunden. Prüfe den Sheet-Namen.`)
      }
      throw error
    }

    return true
  } catch (error) {
    console.error('Google Sheets Verbindungstest fehlgeschlagen:', error)
    if (error instanceof Error) {
      throw error // Wirf den Fehler weiter, damit detaillierte Meldungen angezeigt werden können
    }
    return false
  }
}
