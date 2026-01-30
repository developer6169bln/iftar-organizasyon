import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getUploadsDir } from '@/lib/uploads'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
        { status: 400 }
      )
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Nur Bilder (JPEG, PNG, GIF, WEBP) und PDF erlaubt' },
        { status: 400 }
      )
    }

    const maxSize = 15 * 1024 * 1024 // 15MB für Grundrisse
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Datei zu groß. Maximum: 15MB' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop() || 'pdf'
    const fileName = `floorplan-${eventId}-${Date.now()}.${ext}`
    const uploadsDir = getUploadsDir()
    const filePath = join(uploadsDir, fileName)

    await mkdir(uploadsDir, { recursive: true })

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/uploads/${fileName}`
    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Table plan upload error:', error)
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: 'Fehler beim Hochladen des Grundrisses', details: msg },
      { status: 500 }
    )
  }
}
