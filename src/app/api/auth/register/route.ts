import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUser, getUserByEmail } from '@/lib/auth'

const registerSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    // Kullanıcı zaten var mı kontrol et
    const existingUser = await getUserByEmail(validatedData.email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kullanılıyor' },
        { status: 400 }
      )
    }

    // Yeni kullanıcı oluştur
    const user = await createUser(
      validatedData.email,
      validatedData.name,
      validatedData.password
    )

    // Şifreyi response'dan çıkar
    const { password, ...userWithoutPassword } = user

    return NextResponse.json(
      { message: 'Kayıt başarılı', user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Validierungsfehler' },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Prisma-spezifische Fehler erkennen
    let detailedError = errorMessage
    if (errorMessage.includes('P1001') || errorMessage.includes('Can\'t reach database')) {
      detailedError = 'Datenbankverbindung fehlgeschlagen. Prüfe DATABASE_URL.'
    } else if (errorMessage.includes('P2002') || errorMessage.includes('Unique constraint')) {
      detailedError = 'E-Mail-Adresse bereits vorhanden'
    } else if (errorMessage.includes('P2025') || errorMessage.includes('Record to update not found')) {
      detailedError = 'Datenbank-Tabellen fehlen. Führe Migrationen aus.'
    }
    
    return NextResponse.json(
      { 
        error: 'Kayıt sırasında bir hata oluştu', 
        details: detailedError,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
