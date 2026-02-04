import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getUploadDir } from '@/lib/uploadDir'
import { requireEventAccess, requireAnyPageAccess } from '@/lib/permissions'

async function getMediaAndCheckAccess(
  request: NextRequest,
  id: string
): Promise<{ media: Awaited<ReturnType<typeof prisma.mediaItem.findUnique>> } | NextResponse> {
  const media = await prisma.mediaItem.findUnique({
    where: { id },
  })
  if (!media) {
    return NextResponse.json({ error: 'Medium nicht gefunden' }, { status: 404 })
  }

  const event = await prisma.event.findUnique({
    where: { id: media.eventId },
    select: { projectId: true },
  })
  const access = await requireAnyPageAccess(request, ['foto-video', 'media-upload'], event?.projectId ?? undefined)
  if (access instanceof NextResponse) return access

  const eventAccess = await requireEventAccess(request, media.eventId)
  if (eventAccess instanceof NextResponse) return eventAccess

  return { media }
}

/** Einzelnes Media-Item abrufen */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getMediaAndCheckAccess(request, id)
  if (result instanceof NextResponse) return result

  const media = await prisma.mediaItem.findUnique({
    where: { id },
  })
  return NextResponse.json(media)
}

/** Titel, Text, Checkboxen, Notizen aktualisieren */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getMediaAndCheckAccess(request, id)
  if (result instanceof NextResponse) return result

  const body = await request.json().catch(() => ({}))
  const data: {
    title?: string | null
    text?: string | null
    approvedForSharing?: boolean
    sharedInstagram?: boolean
    sharedFacebook?: boolean
    sharedOtherMedia?: boolean
    notes?: string | null
  } = {}

  if (typeof body.title === 'string') data.title = body.title || null
  if (typeof body.text === 'string') data.text = body.text || null
  if (typeof body.notes === 'string') data.notes = body.notes || null
  if (typeof body.approvedForSharing === 'boolean') data.approvedForSharing = body.approvedForSharing
  if (typeof body.sharedInstagram === 'boolean') data.sharedInstagram = body.sharedInstagram
  if (typeof body.sharedFacebook === 'boolean') data.sharedFacebook = body.sharedFacebook
  if (typeof body.sharedOtherMedia === 'boolean') data.sharedOtherMedia = body.sharedOtherMedia

  const updated = await prisma.mediaItem.update({
    where: { id },
    data,
  })
  return NextResponse.json(updated)
}

/** Media-Item und Datei löschen */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getMediaAndCheckAccess(request, id)
  if (result instanceof NextResponse) return result

  const media = await prisma.mediaItem.findUnique({
    where: { id },
  })
  if (!media) {
    return NextResponse.json({ error: 'Medium nicht gefunden' }, { status: 404 })
  }

  try {
    const filename = media.filePath.replace(/^\/uploads\//, '') || media.filePath.split('/').pop()
    if (filename) {
      const absPath = join(getUploadDir(), filename)
      await unlink(absPath)
    }
  } catch (e) {
    console.warn('Datei beim Löschen nicht gefunden:', media.filePath, e)
  }

  await prisma.mediaItem.delete({
    where: { id },
  })
  return NextResponse.json({ success: true })
}
