import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

function generateCheckInToken(): string {
  return randomBytes(24).toString('hex')
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID ist erforderlich' }, { status: 400 })
    }

    const existing = await prisma.invitation.findUnique({
      where: { id },
      include: { guest: true, accompanyingGuests: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    // Erlaube nur bestimmte Felder zu aktualisieren
    const allowedFields: Record<string, any> = {}
    
    if (updateData.response !== undefined) {
      allowedFields.response = updateData.response
    }
    
    if (updateData.sentAt !== undefined) {
      allowedFields.sentAt = updateData.sentAt ? new Date(updateData.sentAt) : null
    }
    
    if (updateData.sentByPost !== undefined) {
      allowedFields.sentByPost = updateData.sentByPost === true || updateData.sentByPost === 'true'
    }

    if (updateData.whatsappSentAt !== undefined) {
      allowedFields.whatsappSentAt = updateData.whatsappSentAt ? new Date(updateData.whatsappSentAt) : null
    }
    
    if (updateData.openedAt !== undefined) {
      allowedFields.openedAt = updateData.openedAt ? new Date(updateData.openedAt) : null
    }
    
    if (updateData.respondedAt !== undefined) {
      allowedFields.respondedAt = updateData.respondedAt ? new Date(updateData.respondedAt) : null
    }

    if (updateData.templateId !== undefined) {
      allowedFields.templateId = updateData.templateId === '' || updateData.templateId == null ? null : updateData.templateId
    }

    const updatedInvitation = await prisma.$transaction(async (tx) => {
      const inv = await tx.invitation.update({
        where: { id },
        data: allowedFields,
        include: {
          guest: true,
          event: true,
          template: true,
          accompanyingGuests: true,
        },
      })

      // Bei Absage: QR-Code ungültig machen (checkInToken löschen)
      if (updateData.response === 'DECLINED') {
        await tx.guest.update({
          where: { id: inv.guestId },
          data: { checkInToken: null },
        })
        for (const ag of inv.accompanyingGuests) {
          await tx.accompanyingGuest.update({
            where: { id: ag.id },
            data: { checkInToken: generateCheckInToken() },
          })
        }
      }

      // Bei manueller Zusage: Neuen QR-Code erzeugen, wenn keiner vorhanden
      if (updateData.response === 'ACCEPTED' && inv.guest) {
        const guest = await tx.guest.findUnique({
          where: { id: inv.guestId },
          select: { checkInToken: true, additionalData: true },
        })
        if (!guest?.checkInToken) {
          const newToken = generateCheckInToken()
          try {
            const additionalData = guest?.additionalData ? JSON.parse(guest.additionalData) : {}
            additionalData['Zusage'] = true
            additionalData['Zusage Datum'] = new Date().toISOString()
            additionalData['Absage'] = false
            await tx.guest.update({
              where: { id: inv.guestId },
              data: {
                status: 'CONFIRMED',
                checkInToken: newToken,
                additionalData: JSON.stringify(additionalData),
              },
            })
          } catch {
            await tx.guest.update({
              where: { id: inv.guestId },
              data: { status: 'CONFIRMED', checkInToken: newToken },
            })
          }
        }
      }

      return tx.invitation.findUnique({
        where: { id },
        include: {
          guest: true,
          event: true,
          template: true,
          accompanyingGuests: true,
        },
      })
    })

    if (!updatedInvitation) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json(updatedInvitation)
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Einladung:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Aktualisieren der Einladung' },
      { status: 500 }
    )
  }
}
