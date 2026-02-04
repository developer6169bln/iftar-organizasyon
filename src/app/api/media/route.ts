import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getUploadDir } from '@/lib/uploadDir'
import { requireEventAccess, requireAnyPageAccess } from '@/lib/permissions'

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
const MAX_IMAGE_SIZE = 15 * 1024 * 1024 // 15MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

/** Liste aller Media-Items eines Events */
export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'eventId erforderlich' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { projectId: true },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    }

  const access = await requireAnyPageAccess(request, ['foto-video', 'media-upload'], event.projectId ?? undefined)
  if (access instanceof NextResponse) return access

  const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const items = await prisma.mediaItem.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint = msg.includes('media_items') || msg.includes('does not exist')
      ? ' Tabelle media_items fehlt – Migration ausführen: npx prisma migrate deploy'
      : ''
    console.error('GET /api/media error:', err)
    return NextResponse.json(
      { error: 'Medien konnten nicht geladen werden.' + hint, details: msg },
      { status: 500 }
    )
  }
}

/** Upload: Foto oder Video mit optionalem Titel und Text */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const eventId = (formData.get('eventId') as string) || ''
  const type = (formData.get('type') as string) || '' // PHOTO | VIDEO
  const title = (formData.get('title') as string) || null
  const text = (formData.get('text') as string) || null

  if (!file || !eventId || !type) {
    return NextResponse.json(
      { error: 'file, eventId und type (PHOTO oder VIDEO) erforderlich' },
      { status: 400 }
    )
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { projectId: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
  }

  const access = await requireAnyPageAccess(request, ['foto-video', 'media-upload'], event.projectId ?? undefined)
  if (access instanceof NextResponse) return access
  const { userId } = access

  if (type !== 'PHOTO' && type !== 'VIDEO') {
    return NextResponse.json(
      { error: 'type muss PHOTO oder VIDEO sein' },
      { status: 400 }
    )
  }

  const eventAccess = await requireEventAccess(request, eventId)
  if (eventAccess instanceof NextResponse) return eventAccess

  const allowedTypes = type === 'PHOTO' ? IMAGE_TYPES : VIDEO_TYPES
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      {
        error:
          type === 'PHOTO'
            ? 'Nur Bilder (JPEG, PNG, GIF, WEBP) erlaubt'
            : 'Nur Video-Formate (MP4, WebM, MOV, AVI) erlaubt',
      },
      { status: 400 }
    )
  }

  const maxSize = type === 'PHOTO' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        error:
          type === 'PHOTO'
            ? 'Bild zu groß. Maximum: 15MB'
            : 'Video zu groß. Maximum: 100MB',
      },
      { status: 400 }
    )
  }

  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const ext = file.name.split('.').pop() || (type === 'PHOTO' ? 'jpg' : 'mp4')
  const fileName = `${timestamp}-${randomString}.${ext}`
  const uploadsDir = getUploadDir()
  const filePath = join(uploadsDir, fileName)

  await mkdir(uploadsDir, { recursive: true }).catch(() => {})
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  const media = await prisma.mediaItem.create({
    data: {
      eventId,
      type,
      fileName: file.name,
      filePath: `/uploads/${fileName}`,
      fileType: file.type,
      fileSize: file.size,
      title: title || undefined,
      text: text || undefined,
      uploadedBy: userId,
    },
  })

  return NextResponse.json(media)
}
