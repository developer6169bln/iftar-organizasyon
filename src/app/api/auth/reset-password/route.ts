import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(1, 'Token fehlt'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = schema.parse(body)

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
    ])

    return NextResponse.json({
      message: 'Passwort wurde erfolgreich geändert. Sie können sich jetzt anmelden.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Ungültige Eingabe' },
        { status: 400 }
      )
    }
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Passwort konnte nicht geändert werden.' },
      { status: 500 }
    )
  }
}
