import { NextRequest, NextResponse } from 'next/server'
import net from 'node:net'

export const runtime = 'nodejs'
export const maxDuration = 15

type CheckResult = {
  host: string
  port: number
  ok: boolean
  latencyMs?: number
  error?: {
    code?: string
    message: string
  }
}

function checkTcp(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const socket = new net.Socket()

    const finish = (result: CheckResult) => {
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve(result)
    }

    socket.setTimeout(timeoutMs)

    socket.once('connect', () => {
      const latencyMs = Date.now() - startedAt
      finish({ host, port, ok: true, latencyMs })
    })

    socket.once('timeout', () => {
      finish({
        host,
        port,
        ok: false,
        error: { code: 'ETIMEDOUT', message: `Timeout nach ${timeoutMs}ms` },
      })
    })

    socket.once('error', (err: any) => {
      finish({
        host,
        port,
        ok: false,
        error: { code: err?.code, message: err?.message || 'Unbekannter Socket-Fehler' },
      })
    })

    socket.connect(port, host)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Nur vordefinierte Checks erlauben (kein SSRF)
  const provider = (searchParams.get('provider') || 'icloud').toLowerCase()
  const timeoutMs = Math.min(15000, Math.max(1000, parseInt(searchParams.get('timeoutMs') || '7000', 10)))

  if (provider !== 'icloud') {
    return NextResponse.json(
      { error: 'Nur provider=icloud ist erlaubt' },
      { status: 400 }
    )
  }

  const host = 'smtp.mail.me.com'
  const ports = [587, 465]

  const results = await Promise.all(ports.map((p) => checkTcp(host, p, timeoutMs)))

  return NextResponse.json({
    provider,
    host,
    timeoutMs,
    results,
    summary: {
      anyOk: results.some((r) => r.ok),
      okPorts: results.filter((r) => r.ok).map((r) => r.port),
      failedPorts: results.filter((r) => !r.ok).map((r) => ({ port: r.port, code: r.error?.code })),
    },
  })
}

