import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Teste Datenbankverbindung
    let dbStatus = 'unknown'
    try {
      await prisma.$queryRaw`SELECT 1`
      dbStatus = 'connected'
    } catch (error) {
      dbStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`
    }
    
    // Prüfe ob users Tabelle existiert
    let tableStatus = 'unknown'
    try {
      const count = await prisma.user.count()
      tableStatus = `exists (${count} users)`
    } catch (error) {
      tableStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`
    }
    
    // Prüfe DATABASE_URL
    const hasDatabaseUrl = !!process.env.DATABASE_URL
    const databaseUrlPreview = process.env.DATABASE_URL 
      ? `${process.env.DATABASE_URL.substring(0, 30)}...` 
      : 'not set'
    
    return NextResponse.json({
      status: 'debug',
      database: {
        url: hasDatabaseUrl,
        urlPreview: databaseUrlPreview,
        connection: dbStatus,
        usersTable: tableStatus
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET
      },
      requestBody: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    )
  }
}
