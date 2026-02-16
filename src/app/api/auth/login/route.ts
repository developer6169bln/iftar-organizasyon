import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { z } from 'zod'
import { getUserByEmail, verifyPassword } from '@/lib/auth'
import { SignJWT } from 'jose'
import { logLogin } from '@/lib/auditLog'

function runMigrateDeploy(): boolean {
  try {
    execSync('npx prisma migrate deploy', {
      env: process.env,
      timeout: 60000,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(1, 'Şifre gereklidir'),
})

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production')

export async function POST(request: NextRequest) {
  let validatedData: z.infer<typeof loginSchema>
  try {
    const body = await request.json()
    validatedData = loginSchema.parse(body)
  } catch (parseError) {
    if (parseError instanceof z.ZodError) {
      return NextResponse.json(
        { error: parseError.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Ungültige Anfrage (kein JSON oder fehlerhaft)' },
      { status: 400 }
    )
  }

  try {
    const user = await getUserByEmail(validatedData.email)
    if (!user) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }

    if (!user.password || typeof user.password !== 'string') {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }

    let isValidPassword: boolean
    try {
      isValidPassword = await verifyPassword(validatedData.password, user.password)
    } catch {
      isValidPassword = false
    }
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }

    // JWT token oluştur (30 Tage – weniger Abmeldungen bei Programm-Inhabern)
    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    // Şifreyi response'dan çıkar
    const { password, ...userWithoutPassword } = user

    const response = NextResponse.json(
      { 
        message: 'Giriş başarılı', 
        user: userWithoutPassword,
        token: token // Token'ı response'da da gönder (localStorage için)
      },
      { status: 200 }
    )

    // Cookie'ye token ekle (30 Tage, Secure nur wenn HTTPS)
    const isHttps = process.env.NODE_ENV === 'production' && (
      process.env.VERCEL === '1' ||
      process.env.RAILWAY_PUBLIC_DOMAIN != null ||
      (process.env.NEXT_PUBLIC_BASE_URL ?? '').startsWith('https://')
    )
    response.cookies.set('auth-token', token, {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    })

    // Log login (nicht blockieren, falls Audit-Log fehlschlägt)
    try {
      await logLogin(user.id, user.email, request, {
        description: `Benutzer ${user.email} hat sich erfolgreich eingeloggt`,
      })
    } catch (logErr) {
      console.warn('Login-Audit-Log fehlgeschlagen:', logErr)
    }

    return response
  } catch (error) {
    console.error('Login error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    // Prisma-Schema-Fehler (z. B. Migration nicht ausgeführt): klaren Hinweis zurückgeben
    const isSchemaError =
      /does not exist|mainUserCategoryId|main_user_categories|column.*not exist|relation.*does not exist/i.test(errorMessage) ||
      (error as { code?: string }).code === 'P2021' ||
      (error as { code?: string }).code === 'P2010'
    if (isSchemaError) {
      // Einmal automatisch Migration ausführen und Login erneut versuchen
      console.log('Login: Schema-Fehler erkannt – führe prisma migrate deploy aus…')
      if (runMigrateDeploy()) {
        try {
          const user = await getUserByEmail(validatedData.email)
          if (!user || !user.password) {
            return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
          }
          let ok = false
          try {
            ok = await verifyPassword(validatedData.password, user.password)
          } catch {
            ok = false
          }
          if (!ok) {
            return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
          }
          const token = await new SignJWT({ userId: user.id, email: user.email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d')
            .sign(secret)
          const { password: _, ...userWithoutPassword } = user
          const response = NextResponse.json(
            { message: 'Giriş başarılı', user: userWithoutPassword, token },
            { status: 200 }
          )
          const isHttps = process.env.NODE_ENV === 'production' && (
            process.env.VERCEL === '1' || process.env.RAILWAY_PUBLIC_DOMAIN != null ||
            (process.env.NEXT_PUBLIC_BASE_URL ?? '').startsWith('https://')
          )
          response.cookies.set('auth-token', token, {
            httpOnly: false,
            secure: isHttps,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
          })
          try {
            await logLogin(user.id, user.email, request, {
              description: `Benutzer ${user.email} hat sich erfolgreich eingeloggt`,
            })
          } catch (_) {}
          return response
        } catch (retryError) {
          console.error('Login nach Migration fehlgeschlagen:', retryError)
        }
      }
      return NextResponse.json(
        {
          error: 'Datenbank-Migration fehlt. Bitte auf Railway ausführen: railway run npx prisma migrate deploy',
          code: 'MIGRATION_REQUIRED',
        },
        { status: 503 }
      )
    }
    console.error('Login 500:', errorMessage)
    const isRailwayInternal =
      /Can't reach database server|railway\.internal/i.test(errorMessage)
    const hint = isRailwayInternal
      ? 'Datenbank nicht erreichbar. In Railway: Beim App-Service unter Variables "DATABASE_PUBLIC_URL" anlegen und auf die öffentliche URL des Postgres-Services setzen (im Postgres-Service unter Variables/Connect kopieren). Dann Redeploy.'
      : errorMessage.replace(/postgresql:\/\/[^@]+@/i, 'postgresql://***@').slice(0, 200)
    return NextResponse.json(
      {
        error: isRailwayInternal
          ? 'Datenbank von dieser App nicht erreichbar. Bitte DATABASE_PUBLIC_URL in Railway setzen (siehe Hinweis).'
          : 'Anmeldung fehlgeschlagen. Bitte später erneut versuchen oder Admin kontaktieren.',
        code: isRailwayInternal ? 'DB_UNREACHABLE' : 'LOGIN_ERROR',
        hint,
      },
      { status: 500 }
    )
  }
}
