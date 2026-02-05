import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID ist erforderlich' }, { status: 400 })
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
    
    if (updateData.openedAt !== undefined) {
      allowedFields.openedAt = updateData.openedAt ? new Date(updateData.openedAt) : null
    }
    
    if (updateData.respondedAt !== undefined) {
      allowedFields.respondedAt = updateData.respondedAt ? new Date(updateData.respondedAt) : null
    }

    if (updateData.templateId !== undefined) {
      allowedFields.templateId = updateData.templateId === '' || updateData.templateId == null ? null : updateData.templateId
    }

    const updatedInvitation = await prisma.invitation.update({
      where: { id },
      data: allowedFields,
      include: {
        guest: true,
        event: true,
        template: true,
      },
    })

    return NextResponse.json(updatedInvitation)
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Einladung:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Aktualisieren der Einladung' },
      { status: 500 }
    )
  }
}
