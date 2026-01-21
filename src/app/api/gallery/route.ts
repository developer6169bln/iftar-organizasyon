import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const category = searchParams.get('category')

    if (!eventId || !category) {
      return NextResponse.json(
        { error: 'eventId und category erforderlich' },
        { status: 400 }
      )
    }

    // Hole alle Attachments, die zu diesem Event/Category gehören
    // Da wir eventId/category in uploadedBy als JSON speichern, müssen wir filtern
    const allAttachments = await prisma.attachment.findMany({
      where: {
        OR: [
          // Attachments ohne taskId/checklistItemId (Galerie-Uploads)
          {
            taskId: null,
            checklistItemId: null,
            uploadedBy: {
              contains: eventId,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Filtere nach category (aus uploadedBy JSON)
    const galleryItems = allAttachments
      .filter((att) => {
        if (!att.uploadedBy) return false
        try {
          const meta = JSON.parse(att.uploadedBy)
          return meta.eventId === eventId && meta.category === category
        } catch {
          return false
        }
      })
      .map((att) => ({
        id: att.id,
        fileName: att.fileName,
        filePath: att.filePath,
        fileType: att.fileType,
        fileSize: att.fileSize,
        createdAt: att.createdAt,
        isVideo: att.fileType.startsWith('video/'),
        isImage: att.fileType.startsWith('image/'),
      }))

    return NextResponse.json({ items: galleryItems })
  } catch (error) {
    console.error('Gallery fetch error:', error)
    return NextResponse.json(
      { error: 'Galerie konnte nicht geladen werden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
