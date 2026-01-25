import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: Alle Email-Templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')

    const where: any = {}
    if (language) {
      where.language = language
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [{ language: 'asc' }, { isDefault: 'desc' }],
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Fehler beim Abrufen der Email-Templates:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Templates' },
      { status: 500 }
    )
  }
}

// POST: Neues Email-Template erstellen
export async function POST(request: NextRequest) {
  try {
    const { name, language, subject, body, plainText, isDefault } =
      await request.json()

    if (!name || !language || !subject || !body) {
      return NextResponse.json(
        { error: 'Name, Sprache, Betreff und Body sind erforderlich' },
        { status: 400 }
      )
    }

    // Wenn Standard, entferne Standard von anderen Templates derselben Sprache
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { language, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        language,
        subject,
        body,
        plainText,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Fehler beim Erstellen des Email-Templates:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Templates' },
      { status: 500 }
    )
  }
}

// PUT: Email-Template aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const { id, name, language, subject, body, plainText, isDefault } =
      await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich' },
        { status: 400 }
      )
    }

    // Wenn Standard, entferne Standard von anderen Templates derselben Sprache
    if (isDefault) {
      const existing = await prisma.emailTemplate.findUnique({
        where: { id },
      })
      if (existing) {
        await prisma.emailTemplate.updateMany({
          where: { language: existing.language, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        language,
        subject,
        body,
        plainText,
        isDefault,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Email-Templates:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Templates' },
      { status: 500 }
    )
  }
}

// DELETE: Email-Template löschen
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich' },
        { status: 400 }
      )
    }

    await prisma.emailTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fehler beim Löschen des Email-Templates:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Templates' },
      { status: 500 }
    )
  }
}
