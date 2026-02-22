import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { buildQrPdf } from '@/lib/qrPdf'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

export const runtime = 'nodejs'

/**
 * GET – QR-PDF für eine Einladung (Dashboard, mit Auth).
 * Nutzt Einladungs-ID statt Token; für „WhatsApp senden“ in der Einladungsliste.
 * Unabhängig von response (Nimmt Teil = Zugang zu diesem PDF).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const access = await requirePageAccess(request, 'invitations')
  if (access instanceof NextResponse) return access

  try {
    const { invitationId } = await params
    if (!invitationId) {
      return NextResponse.json({ error: 'invitationId fehlt' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        guest: { select: { name: true, checkInToken: true, email: true, additionalData: true } },
        event: { select: { title: true, date: true, location: true, project: { select: { description: true } } } },
        accompanyingGuests: { select: { firstName: true, lastName: true, checkInToken: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden' },
        { status: 404 }
      )
    }

    const eventAccess = await requireEventAccess(request, invitation.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

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
    console.error('Fehler bei QR-PDF-Generierung (Dashboard):', error)
    return NextResponse.json(
      { error: 'PDF konnte nicht erstellt werden' },
      { status: 500 }
    )
  }
}
