import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

/** GET /api/stats/top-users?startDate=...&endDate=... – nur Admin. Erledigte Aufgaben pro User im Zeitraum. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nur für Admin' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const whereCompleted: any = { status: 'COMPLETED' }
    if (startDate || endDate) {
      whereCompleted.completedAt = {}
      if (startDate) whereCompleted.completedAt.gte = new Date(startDate)
      if (endDate) whereCompleted.completedAt.lte = new Date(endDate)
    }

    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tasks'
    `
    const colSet = new Set((cols || []).map((r) => r.column_name))
    if (!colSet.has('completedBy')) {
      return NextResponse.json({
        topUsers: [],
        message: 'Spalte tasks.completedBy fehlt – Migration ausführen.',
      })
    }

    const tasks = await prisma.task.findMany({
      where: whereCompleted,
      select: { completedBy: true },
    })

    const countByUser: Record<string, number> = {}
    for (const t of tasks) {
      const uid = t.completedBy || '__unbekannt__'
      countByUser[uid] = (countByUser[uid] || 0) + 1
    }

    const userIds = Object.keys(countByUser).filter((id) => id !== '__unbekannt__')
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const topUsers = (userIds as string[])
      .map((id) => ({
        userId: id,
        name: userMap[id]?.name ?? 'Unbekannt',
        email: userMap[id]?.email ?? '',
        completedCount: countByUser[id] || 0,
      }))
      .sort((a, b) => b.completedCount - a.completedCount)

    if (countByUser['__unbekannt__']) {
      topUsers.push({
        userId: '',
        name: 'Ohne Zuweisung',
        email: '',
        completedCount: countByUser['__unbekannt__'],
      })
    }

    return NextResponse.json({
      topUsers,
      period: { startDate: startDate || null, endDate: endDate || null },
    })
  } catch (error) {
    console.error('Top users stats error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Statistik' },
      { status: 500 }
    )
  }
}
