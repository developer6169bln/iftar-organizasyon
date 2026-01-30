import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getUploadsDir, getFileNameFromFloorPlanUrl } from '@/lib/uploads'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
    }

    const plan = await prisma.tablePlan.findUnique({
      where: { eventId },
      select: { floorPlanUrl: true },
    })
    if (!plan?.floorPlanUrl) {
      return new NextResponse(null, { status: 404 })
    }

    const fileName = getFileNameFromFloorPlanUrl(plan.floorPlanUrl)
    if (!fileName) {
      return new NextResponse(null, { status: 404 })
    }

    const uploadsDir = getUploadsDir()
    const filePath = join(uploadsDir, fileName)
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME[ext] || 'application/octet-stream'

    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return new NextResponse(null, { status: 404 })
    }
    console.error('Floor plan serve error:', err)
    return NextResponse.json(
      { error: 'Grundriss konnte nicht geladen werden' },
      { status: 500 }
    )
  }
}
