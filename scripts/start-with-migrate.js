/* eslint-disable no-console */
const net = require('node:net')
const fs = require('node:fs/promises')
const { spawn } = require('node:child_process')
const path = require('node:path')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function canConnect(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let done = false

    const finish = (ok) => {
      if (done) return
      done = true
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve(ok)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    if (!env.NODE_ENV) env.NODE_ENV = 'production'
    const child = spawn(cmd, args, { stdio: 'inherit', env, ...opts })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  const binPrisma = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma')
  const binNext = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next')

  const port = process.env.PORT || '3000'
  const nextArgs = ['start', '-p', port]

  // Sofort starten ohne DB/Migration (z.B. SKIP_MIGRATION=true auf Railway)
  if (process.env.SKIP_MIGRATION === 'true') {
    console.log('🚀 SKIP_MIGRATION=true – starte Next.js direkt (PORT=%s)', port)
    await run(binNext, nextArgs)
    return
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.warn('⚠️ DATABASE_URL fehlt – starte App ohne Migration.')
    await run(binNext, nextArgs)
    return
  }

  let host = null
  let dbPort = 5432
  try {
    const u = new URL(dbUrl)
    host = u.hostname
    dbPort = u.port ? parseInt(u.port, 10) : 5432
  } catch (e) {
    console.warn('⚠️ Konnte DATABASE_URL nicht parsen – starte App ohne Migration.', e?.message || e)
    await run(binNext, nextArgs)
    return
  }

  const maxWaitMs = parseInt(process.env.DB_WAIT_TIMEOUT_MS || '15000', 10) // 15s – Railway braucht schnellen Start
  const started = Date.now()

  console.log(`⏳ Warte auf DB TCP: ${host}:${dbPort} (max ${maxWaitMs}ms)`)
  while (Date.now() - started < maxWaitMs) {
    const ok = await canConnect(host, dbPort, 2000)
    if (ok) {
      console.log('✅ DB erreichbar')
      break
    }
    await sleep(2000)
  }

  // Migration beim Start (DB ist jetzt erreichbar)
  const maxMigrateAttempts = parseInt(process.env.PRISMA_MIGRATE_ATTEMPTS || '5', 10)
  const migrateSleepMs = parseInt(process.env.PRISMA_MIGRATE_SLEEP_MS || '3000', 10)
  for (let attempt = 1; attempt <= maxMigrateAttempts; attempt++) {
    try {
      console.log(`🔄 prisma migrate deploy (${attempt}/${maxMigrateAttempts})`)
      await run(binPrisma, ['migrate', 'deploy'])
      console.log('✅ Migration OK')
      break
    } catch (e) {
      console.warn('⚠️ Migration fehlgeschlagen:', e?.message || e)
      if (attempt === maxMigrateAttempts) {
        console.warn('⚠️ Starte App trotzdem – DB/Migration später prüfen.')
        break
      }
      await sleep(migrateSleepMs)
    }
  }

  // Optional: Upload-Verzeichnis anlegen (wenn UPLOAD_DIR z. B. für Railway Volume gesetzt)
  if (process.env.UPLOAD_DIR) {
    try {
      await fs.mkdir(process.env.UPLOAD_DIR, { recursive: true })
      console.log('✅ Upload-Verzeichnis:', process.env.UPLOAD_DIR)
    } catch (e) {
      console.warn('⚠️ UPLOAD_DIR anlegen fehlgeschlagen:', e?.message || e)
    }
  }

  // Optional: Beim Start einen Benutzer auf ADMIN setzen (z. B. SET_ADMIN_EMAIL=yasko1461@gmail.com)
  if (process.env.SET_ADMIN_EMAIL) {
    try {
      console.log('🔄 set-admin-on-start für', process.env.SET_ADMIN_EMAIL)
      await run(process.execPath, [path.join(process.cwd(), 'scripts', 'set-admin-on-start.js')])
    } catch (e) {
      console.warn('⚠️ set-admin-on-start übersprungen:', e?.message || e)
    }
  }

  console.log('🚀 Starte Next.js (PORT=%s)…', port)
  await run(binNext, nextArgs)
}

main().catch((e) => {
  console.error('❌ Fataler Start-Fehler:', e?.message || e)
  process.exit(1)
})

