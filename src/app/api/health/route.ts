import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** GET /api/health → 200 sofort (für Railway/Proxy). Mit ?db=1 wird DB geprüft. */
export async function GET(request: NextRequest) {
  const checkDb = request.nextUrl.searchParams.get('db') === '1'

  if (!checkDb) {
    return NextResponse.json({
      status: 'ok',
      service: 'up',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    const userCount = await prisma.user.count()
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      tables: { users: userCount >= 0 ? 'exists' : 'missing' },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
