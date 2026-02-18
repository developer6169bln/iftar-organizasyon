/**
 * Massenkorrektur der Telefonnummern
 * Formatiert Nummern ins internationale Format (+49 für Mobilfunk).
 * Deutsche Festnetzvorwahlen (030, 040, 089, 0221) bleiben unverändert.
 *
 * Ausführung: node scripts/format-phone-numbers.js
 * Trockenlauf (nur anzeigen, nicht speichern): node scripts/format-phone-numbers.js --dry-run
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')

function formatToInternational(number) {
  if (!number || typeof number !== 'string') return number
  // 1. Alles entfernen, was keine Ziffer oder kein + ist
  const raw = number.replace(/[^\d+]/g, '')

  // 2. Bereits mit +49
  if (raw.startsWith('+49')) return raw

  // 3. 0049 -> +49
  if (raw.startsWith('0049')) return '+49' + raw.slice(4)

  // 4. Deutsche Festnetzvorwahlen unverändert lassen
  const festnetzVorwahlen = ['030', '040', '089', '0221']
  for (const vw of festnetzVorwahlen) {
    if (raw.startsWith(vw)) return raw
  }

  // 5. Mit 0 beginnend (z.B. 0170...)
  if (raw.startsWith('0')) return '+49' + raw.slice(1)

  // 6. Ohne Vorwahl (reine Mobilfunknummer)
  return '+49' + raw
}

async function main() {
  console.log(DRY_RUN ? '=== TROCKENLAUF (keine Änderungen) ===\n' : '=== Massenkorrektur Telefonnummern ===\n')

  let updatedRegistrations = 0
  let updatedGuests = 0

  // EventRegistration
  const registrations = await prisma.eventRegistration.findMany({
    where: { phone: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  })

  for (const reg of registrations) {
    const formatted = formatToInternational(reg.phone)
    if (formatted !== reg.phone) {
      console.log(`EventRegistration ${reg.firstName} ${reg.lastName}:`)
      console.log(`  ${reg.phone} -> ${formatted}`)
      if (!DRY_RUN) {
        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: { phone: formatted },
        })
      }
      updatedRegistrations++
    }
  }

  // Guest
  const guests = await prisma.guest.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
  })

  for (const guest of guests) {
    const formatted = formatToInternational(guest.phone)
    if (formatted !== guest.phone) {
      console.log(`Guest ${guest.name}:`)
      console.log(`  ${guest.phone} -> ${formatted}`)
      if (!DRY_RUN) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { phone: formatted },
        })
      }
      updatedGuests++
    }
  }

  console.log('\n--- Zusammenfassung ---')
  console.log(`EventRegistration: ${updatedRegistrations} geändert`)
  console.log(`Guest: ${updatedGuests} geändert`)
  if (DRY_RUN && (updatedRegistrations > 0 || updatedGuests > 0)) {
    console.log('\nZum Speichern ohne --dry-run ausführen.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
