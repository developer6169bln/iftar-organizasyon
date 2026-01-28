/* eslint-disable no-console */
const net = require('node:net')
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
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
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

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.warn('⚠️ DATABASE_URL fehlt – starte App ohne Migration.')
    await run(binNext, ['start'])
    return
  }

  let host = null
  let port = 5432
  try {
    const u = new URL(dbUrl)
    host = u.hostname
    port = u.port ? parseInt(u.port, 10) : 5432
  } catch (e) {
    console.warn('⚠️ Konnte DATABASE_URL nicht parsen – starte App ohne Migration.', e?.message || e)
    await run(binNext, ['start'])
    return
  }

  const maxWaitMs = parseInt(process.env.DB_WAIT_TIMEOUT_MS || '180000', 10) // 180s
  const started = Date.now()

  console.log(`⏳ Warte auf DB TCP erreichbar: ${host}:${port} (max ${maxWaitMs}ms)`)
  while (Date.now() - started < maxWaitMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await canConnect(host, port, 2000)
    if (ok) {
      console.log('✅ DB TCP erreichbar')
      break
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000)
  }

  // Migration versuchen (mit kurzer Retry-Strategie)
  const maxMigrateAttempts = parseInt(process.env.PRISMA_MIGRATE_ATTEMPTS || '10', 10)
  const allowStartWithoutMigration = (process.env.ALLOW_START_WITHOUT_MIGRATION || 'true').toLowerCase() === 'true'
  for (let attempt = 1; attempt <= maxMigrateAttempts; attempt++) {
    try {
      console.log(`🔄 prisma migrate deploy (Versuch ${attempt}/${maxMigrateAttempts})`)
      // eslint-disable-next-line no-await-in-loop
      await run(binPrisma, ['migrate', 'deploy'])
      console.log('✅ Migration erfolgreich')
      break
    } catch (e) {
      console.error('❌ Migration fehlgeschlagen:', e?.message || e)
      if (attempt === maxMigrateAttempts) {
        if (!allowStartWithoutMigration) {
          console.error('❌ Starte nicht, da Migration nicht durchläuft (DB Schema wäre inkonsistent).')
          process.exit(1)
        }
        console.warn('⚠️ Migration ist fehlgeschlagen, starte trotzdem (ALLOW_START_WITHOUT_MIGRATION=true).')
        break
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(3000)
    }
  }

  console.log('🚀 Starte Next.js…')
  await run(binNext, ['start'])
}

main().catch((e) => {
  console.error('❌ Fataler Start-Fehler:', e?.message || e)
  process.exit(1)
})

