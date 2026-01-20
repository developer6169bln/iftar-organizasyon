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

export async function syncGuestsToGoogleSheets(
  spreadsheetId: string,
  sheetName: string,
  guests: any[]
): Promise<void> {
  try {
    const sheets = await getGoogleSheetsClient()

    // Lösche alte Daten (außer Header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:Z1000`,
    })

    // Erstelle Header falls nicht vorhanden
    const headers = [
      'Name',
      'E-Mail',
      'Telefon',
      'Titel',
      'Organisation',
      'Tischnummer',
      'VIP',
      'Status',
      'Benötigt Empfang',
      'Empfang von',
      'Anreisedatum',
      'Notizen',
    ]

    // Setze Header
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:L1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    })

    // Konvertiere Gäste zu Zeilen
    const rows = guests.map((guest) => [
      guest.name || '',
      guest.email || '',
      guest.phone || '',
      guest.title || '',
      guest.organization || '',
      guest.tableNumber?.toString() || '',
      guest.isVip ? 'Ja' : 'Nein',
      guest.status || 'INVITED',
      guest.needsSpecialReception ? 'Ja' : 'Nein',
      guest.receptionBy || '',
      guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleString('de-DE') : '',
      guest.notes || '',
    ])

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

export async function syncGuestsFromGoogleSheets(
  spreadsheetId: string,
  sheetName: string
): Promise<any[]> {
  try {
    const sheets = await getGoogleSheetsClient()

    // Lese Daten aus Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:L1000`, // Lese bis zu 1000 Zeilen
    })

    const rows = response.data.values || []
    const guests: any[] = []

    // Parse Zeilen zu Gäste-Objekten
    for (const row of rows) {
      if (row[0] && row[0].trim()) {
        // Parse Anreisedatum
        let arrivalDate: Date | null = null
        if (row[10]) {
          try {
            arrivalDate = new Date(row[10])
            if (isNaN(arrivalDate.getTime())) {
              arrivalDate = null
            }
          } catch (e) {
            arrivalDate = null
          }
        }

        guests.push({
          name: row[0]?.trim() || '',
          email: row[1]?.trim() || '',
          phone: row[2]?.trim() || '',
          title: row[3]?.trim() || '',
          organization: row[4]?.trim() || '',
          tableNumber: row[5] ? parseInt(row[5]) || null : null,
          isVip: row[6]?.toLowerCase() === 'ja' || row[6]?.toLowerCase() === 'yes',
          status: row[7]?.trim() || 'INVITED',
          needsSpecialReception: row[8]?.toLowerCase() === 'ja' || row[8]?.toLowerCase() === 'yes',
          receptionBy: row[9]?.trim() || '',
          arrivalDate: arrivalDate,
          notes: row[11]?.trim() || '',
        })
      }
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
