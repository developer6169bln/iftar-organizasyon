import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Eingebautes Secret nur für yasko1461@gmail.com – funktioniert ohne Umgebungsvariable. */
const BUILTIN_ADMIN_EMAIL = 'yasko1461@gmail.com'
const BUILTIN_SECRET = 'IftarAdminYasko2026'

/**
 * Setzt einen Benutzer per E-Mail auf ADMIN.
 * Einfachste Variante (ohne Env): nur für yasko1461@gmail.com
 *   https://deine-app.railway.app/api/auth/set-admin?secret=IftarAdminYasko2026&email=yasko1461@gmail.com
 * Andere E-Mails: SET_ADMIN_SECRET in Railway setzen, dann ?secret=DEIN_SECRET&email=...
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()

  const expectedSecret = process.env.SET_ADMIN_SECRET
  const useBuiltin = email === BUILTIN_ADMIN_EMAIL && secret === BUILTIN_SECRET
  const useEnvSecret = expectedSecret && expectedSecret.length >= 10 && secret === expectedSecret

  if (!useBuiltin && !useEnvSecret) {
    if (!expectedSecret || expectedSecret.length < 10) {
      return NextResponse.json(
        {
          error:
            'Ungültiges Secret. Für yasko1461@gmail.com: ?secret=IftarAdminYasko2026&email=yasko1461@gmail.com',
        },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: 'Ungültiges Secret.' }, { status: 403 })
  }

  if (!email) {
    return NextResponse.json(
      { error: 'Parameter "email" fehlt. Beispiel: ?secret=...&email=yasko1461@gmail.com' },
      { status: 400 }
    )
  }

  try {
    // E-Mail case-insensitive suchen (DB kann Yasko1461@gmail.com speichern)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        {
          error: `Kein Benutzer mit E-Mail "${email}" gefunden. Bitte zuerst registrieren (Register-Seite).`,
        },
        { status: 404 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })

    return NextResponse.json({
      message: `Benutzer ${user.email} wurde zum Administrator (ADMIN) ernannt.`,
    })
  } catch (e) {
    console.error('set-admin error:', e)
    return NextResponse.json(
      { error: 'Datenbankfehler. Bitte später erneut versuchen.' },
      { status: 500 }
    )
  }
}
