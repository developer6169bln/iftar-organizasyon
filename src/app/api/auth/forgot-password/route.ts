import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const schema = z.object({
  email: z.string().email('Bitte gültige E-Mail-Adresse angeben'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    // Immer gleiche Antwort, um zu verhindern, dass E-Mail-Adressen erkennbar sind
    const successMessage = 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet.'

    if (!user) {
      return NextResponse.json({ message: successMessage })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 Stunde

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      request.headers.get('origin') ||
      request.nextUrl.origin
    const resetUrl = `${String(baseUrl).replace(/\/$/, '')}/reset-password?token=${token}`

    const subject = 'Passwort zurücksetzen – Iftar Organizasyon'
    const htmlBody = `
      <p>Hallo ${user.name || 'Nutzer'},</p>
      <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
      <p>Klicken Sie auf den folgenden Link, um ein neues Passwort festzulegen (der Link ist 1 Stunde gültig):</p>
      <p><a href="${resetUrl}">Passwort zurücksetzen</a></p>
      <p>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
      <p>Mit freundlichen Grüßen,<br>Iftar Organizasyon</p>
    `
    const textBody = `
Hallo ${user.name || 'Nutzer'},

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.

Öffnen Sie diesen Link, um ein neues Passwort festzulegen (1 Stunde gültig):
${resetUrl}

Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.

Mit freundlichen Grüßen,
Iftar Organizasyon
    `.trim()

    await sendEmail(user.email, subject, htmlBody, textBody)
    return NextResponse.json({ message: successMessage })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Ungültige Eingabe' },
        { status: 400 }
      )
    }
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.' },
      { status: 500 }
    )
  }
}
