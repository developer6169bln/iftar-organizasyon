import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logCreate, logUpdate, logDelete, logView, getUserIdFromRequest } from '@/lib/auditLog'
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'
import { requirePageAccess, requireEventAccess } from '@/lib/permissions'

const guestSchema = z.object({
  eventId: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  organization: z.string().optional(),
  tableNumber: z.number().optional(),
  isVip: z.boolean().optional(),
  needsSpecialReception: z.boolean().optional(),
  receptionBy: z.string().optional(),
  arrivalDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  additionalData: z.string().optional(), // JSON string für zusätzliche Felder
})

export async function GET(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const status = searchParams.get('status')
    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }
    const where: any = {}
    if (eventId) {
      where.eventId = eventId
    }
    if (status) {
      where.status = status
    }
    const needsReception = searchParams.get('needsReception')
    if (needsReception === 'true') {
      where.needsSpecialReception = true
    }

    const countOnly = searchParams.get('countOnly') === 'true'
    if (countOnly && eventId) {
      const count = await prisma.guest.count({ where })
      return NextResponse.json({ count })
    }

    let guests = await prisma.guest.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    })

    const einladungslisteOnly = searchParams.get('einladungslisteOnly') === 'true'
    if (einladungslisteOnly) {
      guests = guests.filter((g) => {
        const additional = g.additionalData
        if (!additional) return false
        try {
          const data = typeof additional === 'string' ? JSON.parse(additional) : additional
          if (!data || typeof data !== 'object') return false
          const key = Object.keys(data).find((k) => k.trim().toLowerCase() === 'einladungsliste')
          const value = key ? data[key] : undefined
          if (value === undefined) return false
          if (value === true || value === 1) return true
          if (typeof value === 'string') {
            const s = value.trim().toLowerCase()
            return s === 'true' || s === 'ja' || s === 'yes' || s === '1'
          }
          return false
        } catch {
          return false
        }
      })
    }

    // Log view (nicht blockierend, damit Response schneller zurückkommt)
    const userInfo = await getUserIdFromRequest(request)
    logView('GUEST', 'LIST', request, {
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      eventId: eventId || undefined,
      description: `Gästeliste angezeigt (${guests.length} Gäste)`,
    }).catch(() => {})

    return NextResponse.json(guests)
  } catch (error) {
    console.error('Guests fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Misafirler yüklenirken hata oluştu',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access
  try {
    const body = await request.json()
    const eventIdFromBody = body?.eventId
    if (eventIdFromBody) {
      const eventAccess = await requireEventAccess(request, eventIdFromBody)
      if (eventAccess instanceof NextResponse) return eventAccess
    }
    const validatedData = guestSchema.parse(body)

    // Verarbeite additionalData: Parse JSON und konvertiere Boolean-Strings zu echten Booleans
    let additionalDataStr = null
    if (validatedData.additionalData) {
      try {
        const additional = JSON.parse(validatedData.additionalData)
        
        // Konvertiere Boolean-Strings zu echten Booleans
        const normalizedAdditional: Record<string, any> = {}
        for (const [key, value] of Object.entries(additional)) {
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim()
            // Konvertiere String-Booleans zu echten Booleans
            if (lowerValue === 'true') {
              normalizedAdditional[key] = true
            } else if (lowerValue === 'false') {
              normalizedAdditional[key] = false
            } else {
              normalizedAdditional[key] = value
            }
          } else if (typeof value === 'boolean') {
            // Behalte echte Booleans
            normalizedAdditional[key] = value
          } else {
            normalizedAdditional[key] = value
          }
        }
        
        additionalDataStr = JSON.stringify(normalizedAdditional)
      } catch (e) {
        console.error('Fehler beim Parsen von additionalData:', e)
        // Falls Parsing fehlschlägt, speichere als String
        additionalDataStr = validatedData.additionalData
      }
    }

    const guest = await prisma.guest.create({
      data: {
        eventId: validatedData.eventId,
        name: validatedData.name,
        email: validatedData.email && validatedData.email !== '' ? validatedData.email : null,
        phone: validatedData.phone || null,
        title: validatedData.title || null,
        organization: validatedData.organization || null,
        tableNumber: validatedData.tableNumber || null,
        isVip: validatedData.isVip === true,
        needsSpecialReception: validatedData.needsSpecialReception === true,
        receptionBy: validatedData.receptionBy && validatedData.receptionBy !== '' ? validatedData.receptionBy : null,
        arrivalDate: validatedData.arrivalDate && validatedData.arrivalDate !== '' 
          ? (isNaN(Date.parse(validatedData.arrivalDate)) ? null : new Date(validatedData.arrivalDate))
          : null,
        notes: validatedData.notes || null,
        additionalData: additionalDataStr,
        status: 'INVITED',
      },
    })

    // Log create
    const userInfo = await getUserIdFromRequest(request)
    await logCreate('GUEST', guest.id, guest, request, {
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      eventId: validatedData.eventId,
      description: `Gast "${guest.name}" erstellt`,
    })

    // Push Notification senden
    await sendPushNotificationFromServer({
      title: 'Neuer Gast hinzugefügt',
      body: `Gast "${guest.name}" wurde zur Liste hinzugefügt`,
      url: '/dashboard/guests',
      tag: 'guest-added',
    }).catch((error) => {
      // Fehler beim Senden der Notification nicht blockieren
      console.error('Fehler beim Senden der Push Notification:', error)
    })

    return NextResponse.json(guest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('Guest creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Misafir oluşturulurken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }
    const existingGuest = await prisma.guest.findUnique({ where: { id }, select: { eventId: true } })
    if (!existingGuest) {
      return NextResponse.json({ error: 'Gast nicht gefunden' }, { status: 404 })
    }
    const eventAccess = await requireEventAccess(request, existingGuest.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    // Daten für Update vorbereiten
    const dataToUpdate: any = {}
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name
    if (updateData.email !== undefined) {
      dataToUpdate.email = updateData.email && updateData.email !== '' ? updateData.email : null
    }
    if (updateData.phone !== undefined) {
      dataToUpdate.phone = updateData.phone && updateData.phone !== '' ? updateData.phone : null
    }
    if (updateData.title !== undefined) {
      dataToUpdate.title = updateData.title && updateData.title !== '' ? updateData.title : null
    }
    if (updateData.organization !== undefined) {
      dataToUpdate.organization = updateData.organization && updateData.organization !== '' ? updateData.organization : null
    }
    if (updateData.tableNumber !== undefined) {
      dataToUpdate.tableNumber = updateData.tableNumber && updateData.tableNumber !== '' 
        ? (typeof updateData.tableNumber === 'string' ? parseInt(updateData.tableNumber) : updateData.tableNumber)
        : null
    }
    if (updateData.isVip !== undefined) {
      dataToUpdate.isVip = updateData.isVip === true || updateData.isVip === 'true' || updateData.isVip === 1
    }
    if (updateData.status !== undefined) dataToUpdate.status = updateData.status
    if (updateData.notes !== undefined) {
      dataToUpdate.notes = updateData.notes && updateData.notes !== '' ? updateData.notes : null
    }
    if (updateData.arrivalTime !== undefined) {
      dataToUpdate.arrivalTime = updateData.arrivalTime ? new Date(updateData.arrivalTime) : null
    }
    if (updateData.arrivalDate !== undefined) {
      dataToUpdate.arrivalDate = updateData.arrivalDate && updateData.arrivalDate !== '' 
        ? (isNaN(Date.parse(updateData.arrivalDate)) ? null : new Date(updateData.arrivalDate))
        : null
    }
    if (updateData.needsSpecialReception !== undefined) {
      dataToUpdate.needsSpecialReception = updateData.needsSpecialReception === true || updateData.needsSpecialReception === 'true' || updateData.needsSpecialReception === 1
    }
    if (updateData.receptionBy !== undefined) {
      dataToUpdate.receptionBy = updateData.receptionBy && updateData.receptionBy !== '' ? updateData.receptionBy : null
    }
    
    // Behandle additionalData: Parse JSON und konvertiere Boolean-Strings zu echten Booleans
    if (updateData.additionalData !== undefined) {
      try {
        // Wenn es bereits ein String ist, parse es
        const additionalDataStr = typeof updateData.additionalData === 'string' 
          ? updateData.additionalData 
          : JSON.stringify(updateData.additionalData)
        
        const additional = JSON.parse(additionalDataStr)
        
        // Konvertiere Boolean-Strings zu echten Booleans
        const normalizedAdditional: Record<string, any> = {}
        for (const [key, value] of Object.entries(additional)) {
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim()
            // Konvertiere String-Booleans zu echten Booleans
            if (lowerValue === 'true') {
              normalizedAdditional[key] = true
            } else if (lowerValue === 'false') {
              normalizedAdditional[key] = false
            } else {
              normalizedAdditional[key] = value
            }
          } else if (typeof value === 'boolean') {
            // Behalte echte Booleans
            normalizedAdditional[key] = value
          } else {
            normalizedAdditional[key] = value
          }
        }
        
        dataToUpdate.additionalData = JSON.stringify(normalizedAdditional)
      } catch (e) {
        console.error('Fehler beim Parsen von additionalData:', e)
        // Falls Parsing fehlschlägt, speichere als String
        dataToUpdate.additionalData = typeof updateData.additionalData === 'string' 
          ? updateData.additionalData 
          : JSON.stringify(updateData.additionalData)
      }
    }

    // Hole alten Gast für Logging
    const oldGuest = await prisma.guest.findUnique({
      where: { id },
    })
    if (!oldGuest) {
      return NextResponse.json({ error: 'Gast nicht gefunden' }, { status: 404 })
    }

    const guest = await prisma.guest.update({
      where: { id },
      data: dataToUpdate,
    })

    // Log update
    const userInfo = await getUserIdFromRequest(request)
    await logUpdate('GUEST', id, oldGuest, guest, request, {
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      eventId: guest.eventId,
      description: `Gast "${guest.name}" aktualisiert`,
    })

    return NextResponse.json(guest)
  } catch (error) {
    console.error('Guest update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Misafir güncellenirken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const eventId = searchParams.get('eventId')
    const deleteAll = searchParams.get('deleteAll') === 'true'
    const columnName = searchParams.get('columnName')

    if (eventId) {
      const eventAccess = await requireEventAccess(request, eventId)
      if (eventAccess instanceof NextResponse) return eventAccess
    }

    // Wenn columnName vorhanden, lösche die Spalte aus allen Gästen
    if (columnName && eventId) {
      // Hole alle Gäste für dieses Event
      const guests = await prisma.guest.findMany({
        where: { eventId },
      })

      let updatedCount = 0

      // Entferne die Spalte aus additionalData jedes Gastes
      for (const guest of guests) {
        if (guest.additionalData) {
          try {
            const additional = JSON.parse(guest.additionalData)
            
            // Prüfe ob die Spalte existiert
            if (additional.hasOwnProperty(columnName)) {
              // Entferne die Spalte
              delete additional[columnName]
              
              // Aktualisiere den Gast
              await prisma.guest.update({
                where: { id: guest.id },
                data: {
                  additionalData: JSON.stringify(additional),
                },
              })
              
              updatedCount++
            }
          } catch (e) {
            console.error(`Fehler beim Parsen von additionalData für Gast ${guest.id}:`, e)
          }
        }
      }

      // Log delete column
      const userInfo = await getUserIdFromRequest(request)
      await logDelete('GUEST_COLUMN', columnName, { columnName, eventId, updatedCount }, request, {
        userId: userInfo.userId,
        userEmail: userInfo.userEmail,
        eventId,
        description: `Spalte "${columnName}" aus ${updatedCount} Gästen entfernt`,
      })

      return NextResponse.json({
        success: true,
        message: `Spalte "${columnName}" erfolgreich gelöscht`,
        updatedCount,
      })
    }

    // Wenn deleteAll=true, lösche alle Gäste für das Event
    if (deleteAll && eventId) {
      // Hole alle Gäste für Logging
      const guestsToDelete = await prisma.guest.findMany({
        where: { eventId },
      })

      const deletedCount = await prisma.guest.deleteMany({
        where: { eventId },
      })

      // Log delete all
      const userInfo = await getUserIdFromRequest(request)
      await logDelete('GUEST', 'ALL', { count: deletedCount.count, guests: guestsToDelete }, request, {
        userId: userInfo.userId,
        userEmail: userInfo.userEmail,
        eventId,
        description: `${deletedCount.count} Gäste gelöscht (Alle löschen)`,
      })

      return NextResponse.json({ 
        success: true, 
        message: `${deletedCount.count} Gäste erfolgreich gelöscht`,
        deletedCount: deletedCount.count
      })
    }

    // Einzelnen Gast löschen
    if (!id) {
      return NextResponse.json(
        { error: 'ID gereklidir' },
        { status: 400 }
      )
    }

    // Prüfe ob Gast existiert und User Zugriff auf das Event hat
    const guest = await prisma.guest.findUnique({
      where: { id },
    })

    if (!guest) {
      return NextResponse.json(
        { error: 'Gast nicht gefunden' },
        { status: 404 }
      )
    }
    const eventAccess = await requireEventAccess(request, guest.eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    // Lösche Gast
    await prisma.guest.delete({
      where: { id },
    })

    // Log delete
    const userInfo = await getUserIdFromRequest(request)
    await logDelete('GUEST', id, guest, request, {
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      eventId: guest.eventId,
      description: `Gast "${guest.name}" gelöscht`,
    })

    return NextResponse.json({ success: true, message: 'Gast erfolgreich gelöscht' })
  } catch (error) {
    console.error('Guest deletion error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Misafir silinirken hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}

