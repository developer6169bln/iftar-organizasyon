/**
 * Wird beim App-Start ausgeführt, wenn SET_ADMIN_EMAIL gesetzt ist.
 * Setzt den Benutzer mit dieser E-Mail auf ADMIN (case-insensitive).
 * Auf Railway: Variable SET_ADMIN_EMAIL=yasko1461@gmail.com setzen, deployen, danach Variable wieder löschen.
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const email = process.env.SET_ADMIN_EMAIL?.trim().toLowerCase()
if (!email) {
  process.exit(0)
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  })
  if (!user) {
    console.log('⚠️ set-admin-on-start: Kein Benutzer mit E-Mail', email, 'gefunden.')
    process.exit(0)
  }
  if (user.role === 'ADMIN') {
    console.log('✅ set-admin-on-start:', user.email, 'ist bereits ADMIN.')
    process.exit(0)
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  })
  console.log('✅ set-admin-on-start: Benutzer', user.email, 'wurde zum ADMIN ernannt.')
}

main()
  .catch((e) => {
    console.warn('⚠️ set-admin-on-start Fehler:', e?.message || e)
    process.exit(0)
  })
  .finally(() => prisma.$disconnect())
