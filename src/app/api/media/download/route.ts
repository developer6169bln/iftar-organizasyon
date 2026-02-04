import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import { prisma } from '@/lib/prisma'
import { getUploadDir } from '@/lib/uploadDir'
import { requireEventAccess, requireAnyPageAccess } from '@/lib/permissions'

/** Mehrere Medien als ZIP herunterladen. GET /api/media/download?ids=id1,id2 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids')
  const ids = idsParam ? idsParam.split(',').map((id) => id.trim()).filter(Boolean) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids erforderlich (kommagetrennt)' }, { status: 400 })
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Maximal 50 Medien auf einmal' }, { status: 400 })
  }

  const access = await requireAnyPageAccess(request, ['foto-video', 'media-upload'])
  if (access instanceof NextResponse) return access
  const { userId } = access

  const items = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
  })
  if (items.length === 0) {
    return NextResponse.json({ error: 'Keine Medien gefunden' }, { status: 404 })
  }

  const uploadDir = getUploadDir()
  const zip = new JSZip()

  let idx = 0
  for (const item of items) {
    const eventAccess = await requireEventAccess(request, item.eventId)
    if (eventAccess instanceof NextResponse) continue
    const filename = item.filePath.replace(/^\/uploads\//, '') || item.filePath.split('/').pop()
    if (!filename) continue
    try {
      const filePath = join(uploadDir, filename)
      const buffer = await readFile(filePath)
      const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : ''
      const base = (item.title || item.fileName || filename).replace(/[^\w.\-äöüßÄÖÜ]/g, '_').slice(0, 80)
      zip.file(`${idx + 1}-${base}${ext}`, buffer)
      idx++
    } catch {
      // Einzelne Datei fehlt – überspringen
    }
  }

  if (idx === 0) {
    return NextResponse.json({ error: 'Kein Zugriff oder keine Dateien gefunden' }, { status: 403 })
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const body = new Uint8Array(buffer)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="medien.zip"',
    },
  })
}
