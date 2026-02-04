import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

/**
 * GET – Liste der öffentlichen Anmeldungen (nur für eingeloggte Nutzer).
 * Query: eventSlug (optional) – z. B. "uid-iftar" oder "sube-baskanlari"
 */
export async function GET(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const eventSlug = searchParams.get('eventSlug')

    const where: { eventSlug?: string } = {}
    if (eventSlug) where.eventSlug = eventSlug

    const list = await prisma.eventRegistration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(list)
  } catch (error) {
    console.error('Fehler beim Abrufen der Registrierungen:', error)
    return NextResponse.json(
      { error: 'Registrierungen konnten nicht geladen werden' },
      { status: 500 }
    )
  }
}
