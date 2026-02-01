/**
 * Seed: Admin-User (yasko1461@gmail.com) und Editionen Free / Silver / Gold.
 * Aufruf: SEED_ADMIN_PASSWORD=14612023 node scripts/seed-admin-editions.js
 * Ohne SEED_ADMIN_PASSWORD wird 14612023 als Standard verwendet (nur für Erst-Setup).
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'yasko1461@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '14612023'

const PAGE_IDS = [
  'invitations',
  'checkin',
  'reports',
  'audit-logs',
  'push-notifications',
  'vip-namensschilder',
  'tischplanung',
  'guests',
  'program_flow',
]

const CATEGORY_IDS = [
  'PROTOCOL',
  'GUEST_LIST',
  'GUEST_RECEPTION',
  'SECURITY',
  'HOTEL_COORDINATION',
  'SAHUR_COORDINATION',
  'MUSIC_TEAM',
  'SPEAKER',
  'HEADQUARTERS',
  'PROGRAM_FLOW',
]

async function main() {
  console.log('Seed: Editionen und Admin...')

  // 1. Editionen anlegen
  const free = await prisma.edition.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      code: 'FREE',
      name: 'Free Edition',
      annualPriceCents: 0,
      order: 1,
    },
  })
  const silver = await prisma.edition.upsert({
    where: { code: 'SILVER' },
    update: {},
    create: {
      code: 'SILVER',
      name: 'Silver Edition',
      annualPriceCents: 9900, // 99,00 € – Admin kann anpassen
      order: 2,
    },
  })
  const gold = await prisma.edition.upsert({
    where: { code: 'GOLD' },
    update: {},
    create: {
      code: 'GOLD',
      name: 'Gold Edition',
      annualPriceCents: 19900, // 199,00 € – Admin kann anpassen
      order: 3,
    },
  })
  console.log('Editionen:', free.code, silver.code, gold.code)

  // 2. FREE: alle Seiten und Kategorien erlauben (Admin kann später einschränken)
  for (const pageId of PAGE_IDS) {
    await prisma.editionPage.upsert({
      where: {
        editionId_pageId: { editionId: free.id, pageId },
      },
      update: {},
      create: { editionId: free.id, pageId },
    })
  }
  for (const categoryId of CATEGORY_IDS) {
    await prisma.editionCategory.upsert({
      where: {
        editionId_categoryId: { editionId: free.id, categoryId },
      },
      update: {},
      create: { editionId: free.id, categoryId },
    })
  }
  console.log('FREE: alle Seiten und Kategorien zugewiesen')

  // 3. Admin-User anlegen oder Passwort setzen
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: 'ADMIN',
      password: hashedPassword,
      name: 'Admin',
    },
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      password: hashedPassword,
      role: 'ADMIN',
      // editionId leer = Admin sieht alles
    },
  })
  console.log('Admin:', admin.email, 'Role:', admin.role)
  console.log('Fertig. Login:', ADMIN_EMAIL)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
