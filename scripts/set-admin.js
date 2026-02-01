/**
 * Setzt einen Benutzer per E-Mail auf Rolle ADMIN.
 * Aufruf: node scripts/set-admin.js
 * Optional: SET_ADMIN_EMAIL=developer6169@gmail.com node scripts/set-admin.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const EMAIL = process.env.SET_ADMIN_EMAIL || 'developer6169@gmail.com'

async function main() {
  const user = await prisma.user.updateMany({
    where: { email: EMAIL },
    data: { role: 'ADMIN' },
  })
  if (user.count === 0) {
    console.error(`Kein Benutzer mit E-Mail "${EMAIL}" gefunden.`)
    process.exit(1)
  }
  console.log(`Benutzer ${EMAIL} wurde zum Administrator (ADMIN) ernannt.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
