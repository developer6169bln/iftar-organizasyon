import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

function sanitizePdfText(s: string): string {
  return (s || '')
    .replace(/[^\x00-\xFF]/g, '?')
    .replace(/\r?\n/g, ' ')
    .slice(0, 200)
}

/** Event-Details für PDF und E-Mail (türkisch). */
export const EVENT_DETAILS_TEXT = `📅 Tarih:
27 Şubat 2026, Cuma

🕰 Giriş:
16:30

🕰 Program Başlangıcı:
17:00

🕰 İftar Saati:
17:47

📍 Yer:
Moon Events – Festsaal
Oranienstraße 140–142
10969 Berlin`

/** PDF-sichere Version (Emojis entfernt, Standard-Schrift unterstützt ggf. kein Türkisch). */
function pdfSafeDetailsText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis entfernen
    .replace(/📅|🕰|📍/g, '')
    .trim()
}

export type QrPdfInvitation = {
  guest?: { name: string | null; checkInToken: string | null } | null
  event?: { title: string; date: Date; location: string } | null
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  pdfDoc.addPage([595, 842])
  const page = pdfDoc.getPage(0)
  const { width, height } = page.getSize()
  let y = height - 60

  page.drawText('Check-in & Eventinformationen', {
    x: 50,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.4),
  })
  y -= 28

  page.drawText(sanitizePdfText(eventTitle), {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  })
  y -= 20

  if (eventDate) {
    page.drawText('Datum: ' + sanitizePdfText(eventDate), { x: 50, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 18
  }
  if (eventLocation) {
    page.drawText('Ort: ' + sanitizePdfText(eventLocation), { x: 50, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 24
  }

  // Event-Details (türkisch) – Emojis entfernt für PDF
  const detailsLines = pdfSafeDetailsText(EVENT_DETAILS_TEXT)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of detailsLines) {
    if (y < 100) break
    try {
      page.drawText(line || ' ', { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.3) })
    } catch {
      page.drawText(sanitizePdfText(line) || ' ', { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.3) })
    }
    y -= 14
  }
  y -= 16

  const entries: { label: string; token: string }[] = []
  if (invitation.guest?.checkInToken) {
    entries.push({
      label: invitation.guest.name ? sanitizePdfText(invitation.guest.name) : 'Hauptgast',
      token: invitation.guest.checkInToken,
    })
  }
  for (const ag of invitation.accompanyingGuests ?? []) {
    const label = [ag.firstName, ag.lastName].filter(Boolean).join(' ') || 'Begleitperson'
    entries.push({ label: sanitizePdfText(label), token: ag.checkInToken })
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
  const filename = `Check-in-${sanitizePdfText(eventTitle).replace(/\s+/g, '-')}.pdf`
  return { buffer, filename }
}
