import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'
import { pdfSafeTextForWinAnsi } from '@/lib/pdfUnicodeFont'

export const runtime = 'nodejs'

/**
 * GET ?eventId=... – Tischlisten-PDF serverseitig erzeugen.
 * Verwendet nur Helvetica (kein externer Font-Download), damit der Export auf Railway/Server zuverlässig funktioniert.
 * Türkische Zeichen werden durch ASCII-Äquivalente ersetzt (ğ→g, ü→u, …).
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

    const SPOOL_TABLE = 700
    const PRESSE_START = 801
    const PRESSE_SLOTS = 12
    const VIP_START = 901
    const VIP_SLOTS = 18
    const STB_BASKAN_START = 813
    const SPONSOR_STK1_START = 825
    const SPONSOR_STK2_START = 837
    const SPONSOR_STK3_START = 849
    const SPONSOR_STK4_START = 861
    const SPONSOR_STK_SLOTS = 12

    const byTable = new Map<number, string[]>()
    for (const g of guests) {
      const t = g.tableNumber!
      if (!byTable.has(t)) byTable.set(t, [])
      const name = g.name != null ? String(g.name).trim() : ''
      byTable.get(t)!.push(name || '-')
    }
    const allEntries = Array.from(byTable.entries()).sort((a, b) => a[0] - b[0])
    const normalTables = allEntries.filter(([n]) => n < PRESSE_START && n !== SPOOL_TABLE)
    const spoolNames = byTable.get(SPOOL_TABLE) ?? []
    const presseNames = Array.from({ length: PRESSE_SLOTS }, (_, i) => (byTable.get(PRESSE_START + i) ?? [])[0] ?? '-')
    const vipNames = Array.from({ length: VIP_SLOTS }, (_, i) => (byTable.get(VIP_START + i) ?? [])[0] ?? '-')
    const stbBaskanNames = Array.from({ length: SPONSOR_STK_SLOTS }, (_, i) => (byTable.get(STB_BASKAN_START + i) ?? [])[0] ?? '-')
    const sponsorStk1Names = Array.from({ length: SPONSOR_STK_SLOTS }, (_, i) => (byTable.get(SPONSOR_STK1_START + i) ?? [])[0] ?? '-')
    const sponsorStk2Names = Array.from({ length: SPONSOR_STK_SLOTS }, (_, i) => (byTable.get(SPONSOR_STK2_START + i) ?? [])[0] ?? '-')
    const sponsorStk3Names = Array.from({ length: SPONSOR_STK_SLOTS }, (_, i) => (byTable.get(SPONSOR_STK3_START + i) ?? [])[0] ?? '-')
    const sponsorStk4Names = Array.from({ length: SPONSOR_STK_SLOTS }, (_, i) => (byTable.get(SPONSOR_STK4_START + i) ?? [])[0] ?? '-')

    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const safeText = (text: string) => pdfSafeTextForWinAnsi(String(text ?? ''))

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

    for (const [tableNum, names] of normalTables) {
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

    if (spoolNames.length > 0) {
      ensureSpace(120)
      getPage().drawText(safeText('Spool (Warteliste)'), {
        x: 50,
        y,
        size: 14,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.4),
      })
      y -= 22
      for (const name of spoolNames) {
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

    ensureSpace(120)
    getPage().drawText(safeText('Presse'), {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.4),
    })
    y -= 22
    for (let i = 0; i < PRESSE_SLOTS; i++) {
      ensureSpace(60)
      getPage().drawText('  • Platz ' + String(i + 1) + ': ' + safeText(presseNames[i]), {
        x: 50,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= 16
    }
    y -= 8

    ensureSpace(120)
    getPage().drawText(safeText('VIP'), {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.4),
    })
    y -= 22
    for (let i = 0; i < VIP_SLOTS; i++) {
      ensureSpace(60)
      getPage().drawText('  • Platz ' + String(i + 1) + ': ' + safeText(vipNames[i]), {
        x: 50,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= 16
    }
    y -= 8

    ensureSpace(120)
    getPage().drawText(safeText('STB BASKAN'), {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.4),
    })
    y -= 22
    for (let i = 0; i < SPONSOR_STK_SLOTS; i++) {
      ensureSpace(60)
      getPage().drawText('  • Platz ' + String(i + 1) + ': ' + safeText(stbBaskanNames[i]), {
        x: 50,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= 16
    }
    y -= 8

    const sponsorBlocks: Array<{ label: string; names: string[] }> = [
      { label: 'SPONSOR-STK 1', names: sponsorStk1Names },
      { label: 'SPONSOR-STK 2', names: sponsorStk2Names },
      { label: 'SPONSOR-STK 3', names: sponsorStk3Names },
      { label: 'SPONSOR-STK 4', names: sponsorStk4Names },
    ]

    for (const block of sponsorBlocks) {
      ensureSpace(120)
      getPage().drawText(safeText(block.label), {
        x: 50,
        y,
        size: 14,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.4),
      })
      y -= 22
      for (let i = 0; i < SPONSOR_STK_SLOTS; i++) {
        ensureSpace(60)
        getPage().drawText('  • Platz ' + String(i + 1) + ': ' + safeText(block.names[i]), {
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
