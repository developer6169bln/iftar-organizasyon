import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { loadUnicodeFontForPdf, pdfSafeTextForUnicode } from '@/lib/pdfUnicodeFont'

export const runtime = 'nodejs'

type ZusageRow = {
  id: string
  name: string
  vorname: string
  nachname: string
  tischNummer: string
  kategorie: string
  isVip: boolean
  staatInstitution: string
  anrede1: string
  anrede2: string
  anrede3: string
  notizen: string
  anwesend: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rows: ZusageRow[] = Array.isArray(body.rows) ? body.rows : []
    const headers = [
      'Tisch',
      'Gast',
      'Staat/Institution',
      'Kategorie',
      'VIP',
      'Vorname',
      'Name',
      'Anrede 1',
      'Anrede 2',
      'Anrede 3',
      'Anwesend',
      'Notizen',
    ]
    const stringRows = rows.map((r) => [
      r.tischNummer ?? '',
      r.name ?? '',
      r.staatInstitution ?? '',
      r.kategorie ?? '',
      r.isVip ? 'Ja' : 'Nein',
      r.vorname ?? '',
      r.nachname ?? '',
      r.anrede1 ?? '',
      r.anrede2 ?? '',
      r.anrede3 ?? '',
      r.anwesend ? 'Ja' : 'Nein',
      (r.notizen ?? '').slice(0, 80),
    ])

    const pdfDoc = await PDFDocument.create()
    const unicodeFont = await loadUnicodeFontForPdf(pdfDoc)
    const font = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
    const fontBold = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
    const pageSize: [number, number] = [595.28, 841.89]
    const marginX = 30
    const totalWidth = pageSize[0] - marginX * 2
    const colCount = headers.length
    const colWidth = totalWidth / colCount
    const fontSize = 7
    const rowHeight = 12
    const headerHeight = 16

    let page = pdfDoc.addPage(pageSize)
    let y = pageSize[1] - 40

    page.drawText(pdfSafeTextForUnicode('Liste der Gäste mit Zusage'), {
      x: marginX,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    y -= 18
    page.drawText(pdfSafeTextForUnicode(`Stand: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} | ${rows.length} Einträge`), {
      x: marginX,
      y,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    y -= 20

    const drawTableHeader = () => {
      page.drawRectangle({
        x: marginX,
        y: y - headerHeight,
        width: totalWidth,
        height: headerHeight,
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
        color: rgb(0.92, 0.92, 0.92),
      })
      let x = marginX + 4
      for (let i = 0; i < headers.length; i++) {
        const h = pdfSafeTextForUnicode(headers[i]).slice(0, 14)
        page.drawText(h, { x, y: y - 11, size: 6, font: fontBold, color: rgb(0, 0, 0), maxWidth: colWidth - 6 })
        x += colWidth
      }
      y -= headerHeight + 2
    }

    const needNewPage = () => {
      if (y - rowHeight < 40) {
        page = pdfDoc.addPage(pageSize)
        y = pageSize[1] - 40
        drawTableHeader()
        return true
      }
      return false
    }

    drawTableHeader()

    for (const r of stringRows) {
      needNewPage()
      const cellH = rowHeight
      page.drawRectangle({
        x: marginX,
        y: y - cellH,
        width: totalWidth,
        height: cellH,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5,
        color: rgb(1, 1, 1),
      })
      let x = marginX + 4
      for (let i = 0; i < r.length; i++) {
        const text = pdfSafeTextForUnicode(String(r[i] ?? '')).slice(0, 18)
        page.drawText(text, { x, y: y - 9, size: fontSize, font, color: rgb(0, 0, 0), maxWidth: colWidth - 6 })
        x += colWidth
      }
      y -= cellH + 1
    }

    const bytes = await pdfDoc.save()
    const filename = `Zusagen_${new Date().toISOString().split('T')[0]}.pdf`
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('Export PDF Zusagen:', e)
    return NextResponse.json({ error: 'PDF-Export fehlgeschlagen' }, { status: 500 })
  }
}
