import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'

/**
 * GET ?t=TOKEN – liefert ein PNG-QR-Bild für die Check-in-URL.
 * Die URL wird am Eventtag gescannt und markiert den Gast als anwesend.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  if (!token || typeof token !== 'string') {
    return new NextResponse('Token fehlt', { status: 400 })
  }

  const baseUrl = getBaseUrlForInvitationEmails(request)
  const scanUrl = `${baseUrl}/checkin/scan?t=${encodeURIComponent(token)}`

  try {
    const pngBuffer = await QRCode.toBuffer(scanUrl, {
      type: 'png',
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    const body = new Uint8Array(pngBuffer) as unknown as BodyInit
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('QR-Generierung fehlgeschlagen:', e)
    return new NextResponse('QR konnte nicht erstellt werden', { status: 500 })
  }
}
