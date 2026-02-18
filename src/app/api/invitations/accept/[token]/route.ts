import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getBaseUrlForInvitationEmails } from '@/lib/appUrl'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

function generateCheckInToken(): string {
  return randomBytes(24).toString('hex')
}

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
      return NextResponse.json({
        success: true,
        redirectUrl: `${baseUrl}/invitation/success?type=accepted&already=true`,
        already: true,
      })
    }

    if (invitation.response === 'DECLINED') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Sie haben bereits abgesagt. Eine erneute Zusage ist über diesen Link nicht möglich. Für eine neue Zusage wenden Sie sich bitte an UID Berlin.',
        },
        { status: 403 }
      )
    }

    const maxAccompanyingGuests = invitation.event?.maxAccompanyingGuests ?? 5
    let accompanyingGuestsCount = 1
    let accompanyingGuests: Array<{ firstName: string; lastName: string; funktion?: string; email?: string }> = []
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
      const rawList = body?.accompanyingGuests
      if (Array.isArray(rawList) && accompanyingGuestsCount > 1) {
        const needed = accompanyingGuestsCount - 1
        for (let i = 0; i < needed && i < rawList.length; i++) {
          const item = rawList[i]
          if (item && typeof item === 'object') {
            const firstName = typeof item.firstName === 'string' ? item.firstName.trim() : ''
            const lastName = typeof item.lastName === 'string' ? item.lastName.trim() : ''
            if (firstName || lastName) {
              accompanyingGuests.push({
                firstName: firstName || '-',
                lastName: lastName || '-',
                funktion: typeof item.funktion === 'string' ? item.funktion.trim() : undefined,
                email: typeof item.email === 'string' ? item.email.trim() || undefined : undefined,
              })
            }
          }
        }
      }
    } catch {
      // Body fehlt oder ungültig → Standard 1 beibehalten
    }

    const mainGuestCheckInToken = generateCheckInToken()

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
            checkInToken: mainGuestCheckInToken,
          },
        })
      } catch (e) {
        console.error('Fehler beim Aktualisieren von additionalData:', e)
        await prisma.guest.update({
          where: { id: invitation.guestId },
          data: { status: 'CONFIRMED', checkInToken: mainGuestCheckInToken },
        })
      }
    }

    const checkInTokens: Array<{ label: string; token: string; type: 'main' | 'accompanying' }> = [
      { label: invitation.guest?.name ?? 'Hauptgast', token: mainGuestCheckInToken, type: 'main' },
    ]

    for (const ag of accompanyingGuests) {
      const token = generateCheckInToken()
      await prisma.accompanyingGuest.create({
        data: {
          invitationId: invitation.id,
          firstName: ag.firstName,
          lastName: ag.lastName,
          funktion: ag.funktion ?? null,
          email: ag.email ?? null,
          checkInToken: token,
        },
      })
      checkInTokens.push({
        label: `${ag.firstName} ${ag.lastName}`.trim(),
        token,
        type: 'accompanying',
      })
    }

    // Push-Benachrichtigung an alle Abonnenten (wie Check-in): Zusage mit Gesamtanzahl
    try {
      const [totalZusagen, totalAbsagen] = await Promise.all([
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'ACCEPTED' } }),
        prisma.invitation.count({ where: { eventId: invitation.eventId, response: 'DECLINED' } }),
      ])
      const guestName = invitation.guest?.name ?? 'Ein Gast'
      await sendPushNotificationFromServer({
        title: 'Neue Zusage',
        body: `${guestName} hat zugesagt. Gesamt: ${totalZusagen} Zusagen, ${totalAbsagen} Absagen.`,
        url: '/dashboard/invitations',
        tag: 'invitation-accepted',
      }).catch((e) => {
        console.error('Push-Benachrichtigung bei Zusage fehlgeschlagen:', e)
      })
    } catch (e) {
      console.error('Push-Benachrichtigung bei Zusage fehlgeschlagen:', e)
    }

    return NextResponse.json({
      success: true,
      redirectUrl: `${baseUrl}/invitation/success?type=accepted`,
      checkInTokens,
      eventTitle: invitation.event?.title ?? '',
      eventDate: invitation.event?.date ? new Date(invitation.event.date).toISOString() : '',
    })
  } catch (error) {
    console.error('Fehler bei Zusage:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler bei der Verarbeitung' },
      { status: 500 }
    )
  }
}
