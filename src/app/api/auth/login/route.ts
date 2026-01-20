import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserByEmail, verifyPassword } from '@/lib/auth'
import { SignJWT } from 'jose'

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(1, 'Şifre gereklidir'),
})

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    // Kullanıcıyı bul
    const user = await getUserByEmail(validatedData.email)
    if (!user) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }

    // Şifreyi doğrula
    const isValidPassword = await verifyPassword(validatedData.password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }

    // JWT token oluştur
    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
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

    // Cookie'ye token ekle
    response.cookies.set('auth-token', token, {
      httpOnly: false, // Client-side erişim için false
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 gün
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: 'Giriş sırasında bir hata oluştu', details: errorMessage },
      { status: 500 }
    )
  }
}
