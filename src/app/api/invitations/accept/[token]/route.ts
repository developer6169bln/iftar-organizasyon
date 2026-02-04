import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'

/** GET: Weiterleitung zur Zusage-Seite (Formular für Anzahl mitkommender Gäste). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const baseUrl = getBaseUrlForInvitationEmails(request)
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/invitation/error?message=Token+fehlt`)
    }
    return NextResponse.redirect(`${baseUrl}/invitation/accept/${encodeURIComponent(token)}`)
  } catch {
    return NextResponse.redirect(`${baseUrl}/invitation/error?message=Fehler+bei+der+Weiterleitung`)
  }
}

/** POST: Zusage mit Anzahl mitkommender Gäste verarbeiten. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const baseUrl = getBaseUrlForInvitationEmails(request)
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/invitation/error?message=Token+fehlt`)
    }

    const invitation = await prisma.invitation.findUnique({
      where: { acceptToken: token },
      include: { guest: true, event: true },
    })

    if (!invitation) {
      return NextResponse.redirect(`${baseUrl}/invitation/error?message=Einladung+nicht+gefunden`)
    }

    if (invitation.response === 'ACCEPTED') {
      return NextResponse.redirect(`${baseUrl}/invitation/success?type=accepted&already=true`)
    }

    const maxAccompanyingGuests = invitation.event?.maxAccompanyingGuests ?? 5
    let accompanyingGuestsCount = 1
    try {
      const body = await request.json()
      const raw = body?.accompanyingGuestsCount
      if (raw !== undefined && raw !== null) {
        const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw)
        if (!Number.isInteger(n) || n < 1) {
          return NextResponse.json(
            { error: 'Ungültige Anzahl', maxAccompanyingGuests },
            { status: 400 }
          )
        }
        if (n > maxAccompanyingGuests) {
          return NextResponse.json(
            {
              error: `Die maximale Anzahl mitkommender Gäste ist ${maxAccompanyingGuests}. Bitte wählen Sie höchstens ${maxAccompanyingGuests}.`,
              maxAccompanyingGuests,
            },
            { status: 400 }
          )
        }
        accompanyingGuestsCount = n
      }
    } catch {
      // Body fehlt oder ungültig → Standard 1 beibehalten
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        response: 'ACCEPTED',
        respondedAt: new Date(),
        accompanyingGuestsCount,
      },
    })

    const guest = invitation.guest
    if (guest) {
      try {
        const additionalData = guest.additionalData ? JSON.parse(guest.additionalData) : {}
        additionalData['Zusage'] = true
        additionalData['Zusage Datum'] = new Date().toISOString()
        additionalData['Absage'] = false
        additionalData['Mitkommende Gäste'] = accompanyingGuestsCount

        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: {
            status: 'CONFIRMED',
            additionalData: JSON.stringify(additionalData),
          },
        })
      } catch (e) {
        console.error('Fehler beim Aktualisieren von additionalData:', e)
        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: { status: 'CONFIRMED' },
        })
      }
    }

    return NextResponse.json({
      success: true,
      redirectUrl: `${baseUrl}/invitation/success?type=accepted`,
    })
  } catch (error) {
    console.error('Fehler bei Zusage:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler bei der Verarbeitung' },
      { status: 500 }
    )
  }
}
