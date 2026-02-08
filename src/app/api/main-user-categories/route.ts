import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET: Alle Hauptbenutzer-Kategorien (für Zuweisung bei User-Anlage/Bearbeitung).
 * Später können pro Kategorie Berechtigungen vergeben werden.
 */
export async function GET() {
  try {
    const categories = await prisma.mainUserCategory.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, key: true, name: true, order: true },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('GET /api/main-user-categories error:', error)
    const message = error instanceof Error ? error.message : String(error)
    const hint =
      message.includes('main_user_categories') || message.includes('does not exist')
        ? ' Migration ausführen: npx prisma migrate deploy'
        : ''
    return NextResponse.json(
      { error: 'Kategorien konnten nicht geladen werden', details: message, hint: hint || undefined },
      { status: 500 }
    )
  }
}
