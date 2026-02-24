import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import { pdfSafeTextForUnicode } from '@/lib/pdfUnicodeFont'

const UNICODE_FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/arimo/Arimo-Regular.ttf',
]

async function loadUnicodeFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  for (const url of UNICODE_FONT_URLS) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'font/ttf, application/octet-stream, */*' },
      })
      if (res.ok) {
        const bytes = await res.arrayBuffer()
        if (bytes.byteLength > 1000) {
          return await pdfDoc.embedFont(bytes)
        }
      }
    } catch {
      continue
    }
  }
  return null
}

/** PDF-Text mit Unicode (Türkisch etc.); Emojis/Zeilenumbrüche bereinigt. */
function safePdfText(s: string): string {
  return pdfSafeTextForUnicode(s).slice(0, 200)
}

export type QrPdfInvitation = {
  guest?: { name: string | null; checkInToken: string | null } | null
  event?: { title: string; date: Date; location: string; project?: { description: string | null } | null } | null
  accompanyingGuests?: Array<{ firstName: string; lastName: string; checkInToken: string }>
}

/**
 * Erstellt ein PDF mit Eventinfos und QR-Codes für Check-in.
 * Gibt { buffer, filename } zurück.
 */
export async function buildQrPdf(
  invitation: QrPdfInvitation,
  baseUrl: string
): Promise<{ buffer: Buffer; filename: string }> {
  const eventTitle = invitation.event?.title ?? 'Veranstaltung'
  const eventDate = invitation.event?.date
    ? new Date(invitation.event.date).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''
  const eventLocation = invitation.event?.location ?? ''

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const unicodeFont = await loadUnicodeFont(pdfDoc)
  const font = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const fontBold = unicodeFont ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  pdfDoc.addPage([595, 842])
  const page = pdfDoc.getPage(0)
  const { width, height } = page.getSize()
  let y = height - 60

  page.drawText(safePdfText('Check-in & Eventinformationen'), {
    x: 50,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.4),
  })
  y -= 28

  page.drawText(safePdfText(eventTitle), {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  })
  y -= 20

  if (eventDate) {
    page.drawText('Datum: ' + safePdfText(eventDate), { x: 50, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 18
  }
  if (eventLocation) {
    page.drawText('Ort: ' + safePdfText(eventLocation), { x: 50, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 24
  }

  // Projektbeschreibung (falls vorhanden)
  const projectDescription = invitation.event?.project?.description?.trim()
  if (projectDescription) {
    const detailsLines = pdfSafeTextForUnicode(projectDescription)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of detailsLines) {
      if (y < 100) break
      page.drawText(safePdfText(line) || ' ', { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.3) })
      y -= 14
    }
    y -= 16
  }

  const entries: { label: string; token: string }[] = []
  if (invitation.guest?.checkInToken) {
    entries.push({
      label: invitation.guest.name ? safePdfText(invitation.guest.name) : 'Hauptgast',
      token: invitation.guest.checkInToken,
    })
  }
  for (const ag of invitation.accompanyingGuests ?? []) {
    const label = [ag.firstName, ag.lastName].filter(Boolean).join(' ') || 'Begleitperson'
    entries.push({ label: safePdfText(label), token: ag.checkInToken })
  }

  const qrSize = 120
  const margin = 50
  const maxCols = 2
  const rowHeight = qrSize + 36
  let currentPage = pdfDoc.getPage(0)
  let pageY = y
  let col = 0

  for (const entry of entries) {
    if (pageY - rowHeight < 60) {
      pdfDoc.addPage([595, 842])
      currentPage = pdfDoc.getPage(pdfDoc.getPages().length - 1)
      pageY = height - 50
      col = 0
    }

    const scanUrl = `${baseUrl}/checkin/scan?t=${encodeURIComponent(entry.token)}`
    const pngBuffer = await QRCode.toBuffer(scanUrl, {
      type: 'png',
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    const qrImage = await pdfDoc.embedPng(pngBuffer)
    const scale = Math.min(qrSize / qrImage.width, qrSize / qrImage.height)
    const drawWidth = qrImage.width * scale
    const drawHeight = qrImage.height * scale
    const cellWidth = (width - 2 * margin) / maxCols
    const x = margin + col * cellWidth + (cellWidth - drawWidth) / 2

    currentPage.drawText(entry.label, {
      x: margin + col * cellWidth,
      y: pageY - 14,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.4),
    })
    currentPage.drawImage(qrImage, {
      x,
      y: pageY - 14 - drawHeight - 4,
      width: drawWidth,
      height: drawHeight,
    })

    col += 1
    if (col >= maxCols) {
      col = 0
      pageY -= rowHeight
    }
  }

  const pdfBytes = await pdfDoc.save()
  const buffer = Buffer.from(pdfBytes)
  const filename = `Check-in-${safePdfText(eventTitle).replace(/\s+/g, '-')}.pdf`
  return { buffer, filename }
}
