import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    }

    // Prüfe Dateityp
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isXLS = fileName.endsWith('.xls') || fileName.endsWith('.xlsx')

    if (!isCSV && !isXLS) {
      return NextResponse.json(
        { error: 'Ungültiger Dateityp. Bitte laden Sie eine CSV oder XLS/XLSX Datei hoch.' },
        { status: 400 }
      )
    }

    // Lese Datei
    const buffer = Buffer.from(await file.arrayBuffer())
    let rows: any[] = []

    if (isCSV) {
      // Parse CSV
      const csvText = buffer.toString('utf-8')
      const lines = csvText.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        return NextResponse.json({ error: 'CSV-Datei ist leer' }, { status: 400 })
      }

      // Erste Zeile = Header
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      
      // Restliche Zeilen = Daten
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        rows.push(row)
      }
    } else {
      // Parse XLS/XLSX mit xlsx
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

      if (jsonData.length === 0) {
        return NextResponse.json({ error: 'Excel-Datei ist leer' }, { status: 400 })
      }

      // Erste Zeile = Header
      const headers = (jsonData[0] as any[]).map(h => String(h || '').trim())
      
      // Restliche Zeilen = Daten
      for (let i = 1; i < jsonData.length; i++) {
        const values = jsonData[i] as any[]
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] ? String(values[index]).trim() : ''
        })
        rows.push(row)
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Keine Daten in der Datei gefunden' }, { status: 400 })
    }

    // Lösche alle vorhandenen Daten aus einladungsliste_2026
    await prisma.$executeRaw`TRUNCATE TABLE einladungsliste_2026 RESTART IDENTITY CASCADE`

    // Füge neue Daten ein
    let inserted = 0
    for (const row of rows) {
      try {
        // Mappe CSV/XLS Spalten auf Datenbankfelder
        const dbRow: any = {
          einladung_geschickt: row['einladung_geschickt'] === 'true' || row['einladung_geschickt'] === true || row['Einladung geschickt'] === 'true' || false,
          absage: row['absage'] === 'true' || row['absage'] === true || row['Absage'] === 'true' || false,
          zusage: row['zusage'] === 'true' || row['zusage'] === true || row['Zusage'] === 'true' || false,
          einladungsliste: row['einladungsliste'] === 'true' || row['einladungsliste'] === true || row['Einladungsliste'] === 'true' || false,
          kategorie: row['kategorie'] || row['Kategorie'] || null,
          staat_institution: row['staat_institution'] || row['Staat/Institution'] || row['staat'] || row['institution'] || null,
          anrede_1: row['anrede_1'] || row['Anrede 1'] || null,
          anrede_2: row['anrede_2'] || row['Anrede 2'] || null,
          anrede_3: row['anrede_3'] || row['Anrede 3'] || null,
          anrede_4: row['anrede_4'] || row['Anrede 4'] || null,
          vorname: row['vorname'] || row['Vorname'] || null,
          nachname: row['nachname'] || row['Nachname'] || null,
          email_kurumsal: row['email_kurumsal'] || row['Email (kurumsal)'] || row['email'] || null,
          email_privat: row['email_privat'] || row['Email (privat)'] || null,
          schlussformel: row['schlussformel'] || row['Schlussformel'] || null,
          mobil: row['mobil'] || row['Mobil'] || row['mobiltelefon'] || null,
          telefon: row['telefon'] || row['Telefon'] || null,
          strasse: row['strasse'] || row['Straße'] || row['Strasse'] || null,
          plz: row['plz'] || row['PLZ'] || row['Postleitzahl'] || null,
          ort: row['ort'] || row['Ort'] || null,
        }

        await prisma.$executeRaw`
          INSERT INTO einladungsliste_2026 (
            einladung_geschickt, absage, zusage, einladungsliste,
            kategorie, staat_institution,
            anrede_1, anrede_2, anrede_3, anrede_4,
            vorname, nachname,
            email_kurumsal, email_privat,
            schlussformel,
            mobil, telefon,
            strasse, plz, ort
          ) VALUES (
            ${dbRow.einladung_geschickt}, ${dbRow.absage}, ${dbRow.zusage}, ${dbRow.einladungsliste},
            ${dbRow.kategorie}, ${dbRow.staat_institution},
            ${dbRow.anrede_1}, ${dbRow.anrede_2}, ${dbRow.anrede_3}, ${dbRow.anrede_4},
            ${dbRow.vorname}, ${dbRow.nachname},
            ${dbRow.email_kurumsal}, ${dbRow.email_privat},
            ${dbRow.schlussformel},
            ${dbRow.mobil}, ${dbRow.telefon},
            ${dbRow.strasse}, ${dbRow.plz}, ${dbRow.ort}
          )
        `
        inserted++
      } catch (error: any) {
        console.error(`Fehler beim Einfügen von Zeile ${inserted + 1}:`, error)
        // Weiter mit nächster Zeile
      }
    }

    return NextResponse.json({
      success: true,
      message: `${inserted} Einträge erfolgreich importiert`,
      imported: inserted,
      total: rows.length,
    })
  } catch (error: any) {
    console.error('Import-Fehler:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Importieren der Datei' },
      { status: 500 }
    )
  }
}
