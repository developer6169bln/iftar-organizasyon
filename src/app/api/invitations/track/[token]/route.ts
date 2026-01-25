import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Tracking-Pixel für Email-Öffnungen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Finde Einladung
    const invitation = await prisma.invitation.findUnique({
      where: { trackingToken: token },
    })

    if (invitation && !invitation.openedAt) {
      // Markiere als geöffnet
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { openedAt: new Date() },
      })
    }

    // Rückgabe eines 1x1 transparenten GIFs
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Tracking-Fehler:', error)
    // Auch bei Fehler transparentes Pixel zurückgeben
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(pixel, {
      headers: {
        'Content-Type': 'image/gif',
      },
    })
  }
}
