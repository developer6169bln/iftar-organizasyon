import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getUploadDir } from '@/lib/uploadDir'
import { getUserIdFromRequest } from '@/lib/auditLog'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
}

/** Liefert Upload-Dateien per API (nur für eingeloggte Nutzer; funktioniert auf Railway/ephemeral FS). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { filename } = await params
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 })
  }

  const download = request.nextUrl.searchParams.get('download') === '1'

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const contentType = MIME[ext] || 'application/octet-stream'
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400',
  }
  if (download) {
    headers['Content-Disposition'] = `attachment; filename="${filename.replace(/"/g, '\\"')}"`
  }

  const tryPaths = [
    join(getUploadDir(), filename),
    join(process.cwd(), 'public', 'uploads', filename),
  ]
  for (const filePath of tryPaths) {
    try {
      const buffer = await readFile(filePath)
      return new NextResponse(new Uint8Array(buffer), { headers })
    } catch {
      continue
    }
  }
  return NextResponse.json(
    { error: 'Datei nicht gefunden. Auf Railway: UPLOAD_DIR/Volume prüfen, Dateien können nach Deploy weg sein.' },
    { status: 404 }
  )
}
