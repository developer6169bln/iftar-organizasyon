import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmailTransporter } from '@/lib/email'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { configId, testEmail } = await request.json()

    if (!testEmail) {
      return NextResponse.json(
        { error: 'Test-E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      )
    }

    // Hole Email-Config
    let config
    if (configId) {
      config = await prisma.emailConfig.findUnique({
        where: { id: configId },
      })
    } else {
      config = await prisma.emailConfig.findFirst({
        where: { isActive: true },
      })
    }

    if (!config) {
      return NextResponse.json(
        { error: 'Email-Konfiguration nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe Konfiguration
    if (!config.email) {
      return NextResponse.json(
        { error: 'E-Mail-Adresse fehlt in der Konfiguration' },
        { status: 400 }
      )
    }

    if (config.type === 'GMAIL' && !config.appPassword && !config.password) {
      return NextResponse.json(
        { error: 'Gmail App-Passwort fehlt' },
        { status: 400 }
      )
    }

    if (config.type === 'ICLOUD' && !config.appPassword && !config.password) {
      return NextResponse.json(
        { error: 'iCloud App-Passwort fehlt' },
        { status: 400 }
      )
    }

    if (config.type === 'IMAP' && (!config.smtpHost || !config.password)) {
      return NextResponse.json(
        { error: 'SMTP-Host oder Passwort fehlt' },
        { status: 400 }
      )
    }

    // Erstelle Transporter
    let transporter
    try {
      if (config.type === 'GMAIL') {
        const password = config.appPassword || config.password || ''
        transporter = require('nodemailer').createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // true für 465, false für andere Ports
          auth: {
            user: config.email,
            pass: password,
          },
          tls: {
            rejectUnauthorized: true,
          },
        } as any)
        console.log('📧 Gmail-Transporter erstellt (SMTP) für:', config.email)
      } else if (config.type === 'ICLOUD') {
        const password = config.appPassword || config.password || ''
        transporter = require('nodemailer').createTransport({
          host: 'smtp.mail.me.com',
          port: 587,
          secure: false, // TLS auf Port 587
          auth: {
            user: config.email,
            pass: password,
          },
          tls: {
            rejectUnauthorized: true,
          },
        } as any)
        console.log('📧 iCloud-Transporter erstellt (SMTP) für:', config.email)
      } else {
        transporter = require('nodemailer').createTransport({
          host: config.smtpHost || 'smtp.gmail.com',
          port: config.smtpPort || 587,
          secure: config.smtpPort === 465, // true für 465, false für andere Ports
          auth: {
            user: config.email,
            pass: config.password || config.appPassword || '',
          },
        } as any)
        console.log('📧 SMTP-Transporter erstellt:', {
          host: config.smtpHost || 'smtp.gmail.com',
          port: config.smtpPort || 587,
          secure: config.smtpPort === 465,
        })
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Transporters:', error)
      return NextResponse.json(
        { 
          error: 'Fehler beim Erstellen des Email-Transporters',
          details: error instanceof Error ? error.message : 'Unbekannter Fehler'
        },
        { status: 500 }
      )
    }

    // Teste Verbindung
    try {
      console.log('📧 Teste Email-Verbindung...')
      await transporter.verify()
      console.log('✅ Email-Verbindung erfolgreich')
    } catch (verifyError) {
      console.error('❌ Email-Verbindungstest fehlgeschlagen:', verifyError)
      
      let errorMessage = 'Verbindungstest fehlgeschlagen'
      if (verifyError instanceof Error) {
        const errorMsg = verifyError.message.toLowerCase()
        const errorCode = (verifyError as any).code || ''
        
        if (errorCode === 'EAUTH' || errorMsg.includes('invalid login') || errorMsg.includes('authentication failed')) {
          if (config.type === 'GMAIL') {
            errorMessage = 'Gmail-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein App-Passwort (nicht Ihr normales Passwort)\n2. 2-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. E-Mail-Adresse ist korrekt'
          } else if (config.type === 'ICLOUD') {
            errorMessage = 'iCloud-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein app-spezifisches Passwort (nicht Ihr normales iCloud-Passwort)\n2. Zwei-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. iCloud-E-Mail-Adresse ist korrekt'
          } else {
            errorMessage = 'Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre SMTP-Zugangsdaten.'
          }
        } else if (errorCode === 'ECONNECTION' || errorMsg.includes('connection')) {
          errorMessage = 'Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und Firewall-Einstellungen.'
        } else {
          errorMessage = verifyError.message
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Verbindungstest fehlgeschlagen',
          details: errorMessage
        },
        { status: 500 }
      )
    }

    // Sende Test-E-Mail
    try {
      const mailOptions = {
        from: `"Iftar Organizasyon Test" <${config.email}>`,
        to: testEmail,
        subject: 'Test-E-Mail von Iftar Organizasyon',
        html: '<p>Dies ist eine Test-E-Mail. Wenn Sie diese Nachricht erhalten, funktioniert Ihre Email-Konfiguration korrekt.</p>',
        text: 'Dies ist eine Test-E-Mail. Wenn Sie diese Nachricht erhalten, funktioniert Ihre Email-Konfiguration korrekt.',
      }

      const info = await transporter.sendMail(mailOptions)
      console.log('✅ Test-E-Mail erfolgreich gesendet:', info.messageId)

      return NextResponse.json({
        success: true,
        message: 'Test-E-Mail erfolgreich gesendet',
        messageId: info.messageId,
      })
    } catch (sendError) {
      console.error('❌ Fehler beim Senden der Test-E-Mail:', sendError)
      
      let errorMessage = 'Fehler beim Senden der Test-E-Mail'
      if (sendError instanceof Error) {
        const errorMsg = sendError.message.toLowerCase()
        const errorCode = (sendError as any).code || ''
        const responseCode = (sendError as any).responseCode || ''
        
        if (errorCode === 'EAUTH' || responseCode === '535' || errorMsg.includes('invalid login')) {
          errorMessage = 'Gmail-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihr App-Passwort.'
        } else if (errorCode === 'ECONNECTION') {
          errorMessage = 'Verbindung zum Gmail-Server fehlgeschlagen.'
        } else {
          errorMessage = sendError.message
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Fehler beim Senden der Test-E-Mail',
          details: errorMessage
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Fehler in Email-Config Test API:', error)
    return NextResponse.json(
      { 
        error: 'Fehler beim Testen der Email-Konfiguration',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    )
  }
}
