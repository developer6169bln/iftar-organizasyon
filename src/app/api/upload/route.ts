import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const taskId = formData.get('taskId') as string | null
    const checklistItemId = formData.get('checklistItemId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (!taskId && !checklistItemId) {
      return NextResponse.json(
        { error: 'taskId oder checklistItemId erforderlich' },
        { status: 400 }
      )
    }

    // Validiere Dateityp (nur Bilder und PDFs)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Nur Bilder (JPEG, PNG, GIF, WEBP) und PDFs sind erlaubt' },
        { status: 400 }
      )
    }

    // Validiere Dateigröße (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Datei ist zu groß. Maximum: 10MB' },
        { status: 400 }
      )
    }

    // Erstelle eindeutigen Dateinamen
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomString}.${fileExtension}`
    
    // Speichere Datei im public/uploads Ordner
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    const filePath = join(uploadsDir, fileName)

    // Stelle sicher, dass der Ordner existiert
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Ordner existiert bereits
    }

    // Konvertiere File zu Buffer und speichere
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Speichere Metadaten in der Datenbank
    const attachment = await prisma.attachment.create({
      data: {
        taskId: taskId || undefined,
        checklistItemId: checklistItemId || undefined,
        fileName: file.name,
        filePath: `/uploads/${fileName}`,
        fileType: file.type,
        fileSize: file.size,
      },
    })

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        filePath: attachment.filePath,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        createdAt: attachment.createdAt,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Hochladen der Datei' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID erforderlich' },
        { status: 400 }
      )
    }

    // Hole Attachment aus DB
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Anhang nicht gefunden' },
        { status: 404 }
      )
    }

    // Lösche Datei vom Dateisystem
    try {
      const { unlink } = await import('fs/promises')
      const { join } = await import('path')
      const filePath = join(process.cwd(), 'public', attachment.filePath)
      await unlink(filePath)
    } catch (error) {
      console.error('Fehler beim Löschen der Datei:', error)
      // Weiter mit DB-Löschung auch wenn Datei nicht gefunden wurde
    }

    // Lösche aus DB
    await prisma.attachment.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Anhang gelöscht' })
  } catch (error) {
    console.error('Delete attachment error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Anhangs' },
      { status: 500 }
    )
  }
}
