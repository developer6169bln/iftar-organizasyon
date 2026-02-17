import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

/**
 * GET – Liefert acceptToken und checkInToken für eine Anmeldung mit bereits erstelltem QR.
 * Query: eventId (erforderlich)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const { registrationId } = await params
    const eventId = request.nextUrl.searchParams.get('eventId')

    if (!registrationId || !eventId) {
      return NextResponse.json(
        { error: 'registrationId und eventId sind erforderlich.' },
        { status: 400 }
      )
    }

    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    })

    if (!registration || !registration.invitationSentAt) {
      return NextResponse.json(
        { error: 'Kein QR-Code für diese Anmeldung vorhanden.' },
        { status: 404 }
      )
    }

    const fullName = [registration.firstName, registration.lastName].filter(Boolean).join(' ').trim()

    const guest = await prisma.guest.findFirst({
      where: {
        eventId,
        OR: [
          { email: registration.email },
          { name: { equals: fullName, mode: 'insensitive' } },
        ],
      },
      include: { invitations: { where: { eventId }, take: 1 } },
    })

    const inv = guest?.invitations?.[0]
    if (!guest?.checkInToken || !inv) {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      acceptToken: inv.acceptToken,
      checkInToken: guest.checkInToken,
      fullName: guest.name,
    })
  } catch (error) {
    console.error('Fehler beim Abrufen der QR-Info:', error)
    return NextResponse.json(
      { error: 'QR-Info konnte nicht geladen werden.' },
      { status: 500 }
    )
  }
}
