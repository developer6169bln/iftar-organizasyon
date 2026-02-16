import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { buildQrPdf } from '@/lib/qrPdf'

export const runtime = 'nodejs'

/**
 * GET – PDF mit Eventinformationen und QR-Codes für Check-in (nur bei bereits akzeptierter Einladung).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { acceptToken: token },
      include: {
        guest: { select: { name: true, checkInToken: true, email: true, additionalData: true } },
        event: { select: { title: true, date: true, location: true, project: { select: { description: true } } } },
        accompanyingGuests: { select: { firstName: true, lastName: true, checkInToken: true } },
      },
    })

    if (!invitation || invitation.response !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden oder noch nicht zugesagt' },
        { status: 404 }
      )
    }

    const baseUrl = getBaseUrlForInvitationEmails(request)
    const { buffer, filename } = await buildQrPdf(invitation, baseUrl)
    const body = new Uint8Array(buffer) as unknown as BodyInit

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('Fehler bei QR-PDF-Generierung:', error)
    return NextResponse.json(
      { error: 'PDF konnte nicht erstellt werden' },
      { status: 500 }
    )
  }
}
