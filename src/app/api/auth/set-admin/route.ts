import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Setzt einen Benutzer per E-Mail auf ADMIN – nur mit gültigem Secret.
 * Einmal aufrufen, z. B.:
 *   https://deine-app.railway.app/api/auth/set-admin?secret=DEIN_SECRET&email=developer6169@gmail.com
 * In Railway: Variable SET_ADMIN_SECRET setzen (z. B. ein langer Zufallsstring).
 * Nach dem Setzen: Variable wieder löschen oder Secret ändern.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()

  const expectedSecret = process.env.SET_ADMIN_SECRET
  if (!expectedSecret || expectedSecret.length < 10) {
    return NextResponse.json(
      { error: 'Nicht konfiguriert. SET_ADMIN_SECRET in den Umgebungsvariablen setzen (min. 10 Zeichen).' },
      { status: 501 }
    )
  }

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Ungültiges Secret.' }, { status: 403 })
  }

  if (!email) {
    return NextResponse.json(
      { error: 'Parameter "email" fehlt. Beispiel: ?secret=...&email=developer6169@gmail.com' },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.user.updateMany({
      where: { email },
      data: { role: 'ADMIN' },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: `Kein Benutzer mit E-Mail "${email}" gefunden.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `Benutzer ${email} wurde zum Administrator (ADMIN) ernannt.`,
    })
  } catch (e) {
    console.error('set-admin error:', e)
    return NextResponse.json(
      { error: 'Datenbankfehler.' },
      { status: 500 }
    )
  }
}
