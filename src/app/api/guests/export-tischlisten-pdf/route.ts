import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { loadUnicodeFontForPdf, pdfSafeTextForUnicode, pdfSafeTextForWinAnsi } from '@/lib/pdfUnicodeFont'

export const runtime = 'nodejs'

/**
 * GET ?eventId=... – Tischlisten-PDF serverseitig erzeugen (Unicode-Font wenn möglich, sonst Helvetica mit ASCII-Text).
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requirePageAccess(request, 'guests')
    if (access instanceof NextResponse) return access

    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'eventId erforderlich' }, { status: 400 })
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const guests = await prisma.guest.findMany({
      where: { eventId, tableNumber: { not: null } },
      select: { name: true, tableNumber: true },
      orderBy: [{ tableNumber: 'asc' }, { name: 'asc' }],
    })

    const byTable = new Map<number, string[]>()
    for (const g of guests) {
      const t = g.tableNumber!
      if (!byTable.has(t)) byTable.set(t, [])
      byTable.get(t)!.push((g.name || '').trim() || '–')
    }
    const sortedTables = Array.from(byTable.entries()).sort((a, b) => a[0] - b[0])

    const doc = await PDFDocument.create()
    const unicodeFont = await loadUnicodeFontForPdf(doc)
    const font = unicodeFont ?? (await doc.embedFont(StandardFonts.Helvetica))
    const fontBold = unicodeFont ?? (await doc.embedFont(StandardFonts.HelveticaBold))
    const safeText = unicodeFont ? pdfSafeTextForUnicode : pdfSafeTextForWinAnsi

    doc.addPage([595, 842])
    const pageHeight = 842
    let y = pageHeight - 50

    const getPage = () => doc.getPage(doc.getPageCount() - 1)
    const ensureSpace = (need: number) => {
      if (y < need) {
        doc.addPage([595, 842])
        y = pageHeight - 40
      }
    }

    getPage().drawText(safeText('Tischlisten'), {
      x: 50,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.4),
    })
    y -= 28

    for (const [tableNum, names] of sortedTables) {
      ensureSpace(120)
      getPage().drawText(safeText(`Tisch ${tableNum}`), {
        x: 50,
        y,
        size: 14,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.4),
      })
      y -= 22
      for (const name of names) {
        ensureSpace(60)
        getPage().drawText('  • ' + safeText(name), {
          x: 50,
          y,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.1),
        })
        y -= 16
      }
      y -= 8
    }

    const pdfBytes = await doc.save()
    const filename = `Tischlisten_${new Date().toISOString().split('T')[0]}.pdf`
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('export-tischlisten-pdf error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'PDF konnte nicht erstellt werden', details: msg },
      { status: 500 }
    )
  }
}
