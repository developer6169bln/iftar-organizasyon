import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST() {
  // Nur in Development oder mit Secret Key erlauben
  const secret = process.env.MIGRATE_SECRET
  const providedSecret = (await import('next/headers')).headers().get('x-migrate-secret')
  
  if (process.env.NODE_ENV === 'production' && secret && providedSecret !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Führe Migrationen aus
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      env: process.env,
      timeout: 30000
    })

    return NextResponse.json({
      success: true,
      message: 'Migrations erfolgreich ausgeführt',
      output: stdout,
      error: stderr || null
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Prüfe Migration-Status
    const { stdout } = await execAsync('npx prisma migrate status', {
      env: process.env,
      timeout: 10000
    })

    return NextResponse.json({
      status: 'ok',
      migrationStatus: stdout
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
