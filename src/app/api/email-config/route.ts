import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: Alle Email-Konfigurationen
export async function GET() {
  try {
    const configs = await prisma.emailConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        mailgunDomain: true,
        mailgunRegion: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Passwörter nicht zurückgeben
      },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Fehler beim Abrufen der Email-Konfigurationen:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Konfigurationen' },
      { status: 500 }
    )
  }
}

// POST: Neue Email-Konfiguration erstellen
export async function POST(request: NextRequest) {
  try {
    const {
      name,
      type,
      email,
      password,
      appPassword,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      mailgunDomain,
      mailgunApiKey,
      mailgunRegion,
      isActive,
    } = await request.json()

    if (!name || !type || !email) {
      return NextResponse.json(
        { error: 'Name, Typ und E-Mail sind erforderlich' },
        { status: 400 }
      )
    }

    // Wenn aktiv, deaktiviere alle anderen
    if (isActive) {
      await prisma.emailConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
    }

    // WICHTIG: Passwörter werden im Klartext gespeichert, da sie für Email-Versand benötigt werden
    // In Produktion sollte hier eine Verschlüsselung verwendet werden (z.B. mit crypto)
    // Für jetzt speichern wir sie direkt (nur für interne/vertrauenswürdige Umgebungen)

    const config = await prisma.emailConfig.create({
      data: {
        name,
        type,
        email,
        password: password || null,
        appPassword: appPassword || null,
        imapHost: type === 'IMAP' ? imapHost : null,
        imapPort: type === 'IMAP' ? imapPort : null,
        smtpHost: type === 'IMAP' ? smtpHost : null,
        smtpPort: type === 'IMAP' ? smtpPort : null,
        mailgunDomain: type === 'MAILGUN' ? (mailgunDomain || null) : null,
        mailgunApiKey: type === 'MAILGUN' ? (mailgunApiKey || null) : null,
        mailgunRegion: type === 'MAILGUN' ? (mailgunRegion || null) : null,
        isActive: isActive || false,
      },
    })

    return NextResponse.json({
      ...config,
      password: undefined,
      appPassword: undefined,
      mailgunApiKey: undefined,
    })
  } catch (error) {
    console.error('Fehler beim Erstellen der Email-Konfiguration:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Konfiguration' },
      { status: 500 }
    )
  }
}

// PUT: Email-Konfiguration aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      name,
      type,
      email,
      password,
      appPassword,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      mailgunDomain,
      mailgunApiKey,
      mailgunRegion,
      isActive,
    } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich' },
        { status: 400 }
      )
    }

    // Wenn aktiv, deaktiviere alle anderen
    if (isActive) {
      await prisma.emailConfig.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      })
    }

    const updateData: any = {
      name,
      type,
      email,
      imapHost: type === 'IMAP' ? imapHost : null,
      imapPort: type === 'IMAP' ? imapPort : null,
      smtpHost: type === 'IMAP' ? smtpHost : null,
      smtpPort: type === 'IMAP' ? smtpPort : null,
      mailgunDomain: type === 'MAILGUN' ? (mailgunDomain || null) : null,
      mailgunRegion: type === 'MAILGUN' ? (mailgunRegion || null) : null,
      isActive,
    }

    // Nur Passwörter aktualisieren wenn angegeben
    if (password !== undefined) {
      updateData.password = password || null
    }
    if (appPassword !== undefined) {
      updateData.appPassword = appPassword || null
    }
    // Mailgun API Key nur aktualisieren, wenn ein neuer (nicht leerer) Wert gesendet wurde
    if (type === 'MAILGUN' && mailgunApiKey !== undefined && String(mailgunApiKey).trim() !== '') {
      updateData.mailgunApiKey = mailgunApiKey
    }

    const config = await prisma.emailConfig.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      ...config,
      password: undefined,
      appPassword: undefined,
      mailgunApiKey: undefined,
    })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Email-Konfiguration:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Konfiguration' },
      { status: 500 }
    )
  }
}

// DELETE: Email-Konfiguration löschen
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

    await prisma.emailConfig.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fehler beim Löschen der Email-Konfiguration:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Konfiguration' },
      { status: 500 }
    )
  }
}
