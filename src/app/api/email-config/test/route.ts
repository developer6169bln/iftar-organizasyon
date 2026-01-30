import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Erstelle Transporter (für SMTP-basierte Provider)
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
        
        // Stelle sicher, dass die E-Mail-Adresse vollständig ist
        const emailAddress = (config.email || '').trim()
        if (!emailAddress || !emailAddress.includes('@')) {
          return NextResponse.json(
            { error: 'Ungültige iCloud-E-Mail-Adresse. Bitte verwenden Sie eine vollständige Adresse (z.B. name@icloud.com)' },
            { status: 400 }
          )
        }
        
        // iCloud SMTP
        // Port 587: STARTTLS (secure=false + requireTLS=true)
        // Port 465: SSL/TLS (secure=true)
        const smtpHost = config.smtpHost || 'smtp.mail.me.com'
        const smtpPort = config.smtpPort || 587
        const secure = smtpPort === 465
        transporter = require('nodemailer').createTransport({
          host: smtpHost,
          port: smtpPort,
          secure,
          requireTLS: !secure,
          auth: {
            user: emailAddress,
            pass: password,
          },
          tls: {
            rejectUnauthorized: true,
          },
          connectionTimeout: 10000, // 10 Sekunden Timeout
          greetingTimeout: 10000,
          socketTimeout: 10000,
        } as any)
        console.log('📧 iCloud-Transporter erstellt (SMTP) für:', emailAddress)
        console.log('📧 iCloud SMTP-Einstellungen:', {
          host: smtpHost,
          port: smtpPort,
          secure,
          mode: secure ? 'SSL/TLS (465)' : 'STARTTLS (587)',
        })
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

    // Teste Verbindung (nur für SMTP-basierte Provider)
    try {
      console.log('📧 Teste Email-Verbindung (SMTP)...')
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
        } else if (errorCode === 'ECONNECTION' || errorMsg.includes('connection') || errorMsg.includes('timeout') || errorMsg.includes('econnrefused') || errorMsg.includes('enotfound')) {
          if (config.type === 'ICLOUD') {
            errorMessage = 'Verbindung zum iCloud-Server fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Internetverbindung\n2. Firewall-Einstellungen\n3. Port 587 ist nicht blockiert\n4. smtp.mail.me.com ist erreichbar'
          } else {
            errorMessage = 'Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und Firewall-Einstellungen.'
          }
        } else {
          // Detaillierte Fehlermeldung für Debugging
          const fullError = verifyError instanceof Error ? verifyError.message : String(verifyError)
          const errorDetails = (verifyError as any).code ? ` (Code: ${(verifyError as any).code})` : ''
          errorMessage = `${fullError}${errorDetails}`
          
          if (config.type === 'ICLOUD') {
            errorMessage += '\n\niCloud-spezifische Hinweise:\n- Stellen Sie sicher, dass Zwei-Faktor-Authentifizierung aktiviert ist\n- Verwenden Sie ein app-spezifisches Passwort von appleid.apple.com\n- Die E-Mail-Adresse muss vollständig sein (z.B. name@icloud.com)'
          }
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
        
        if (errorCode === 'EAUTH' || responseCode === '535' || errorMsg.includes('invalid login') || errorMsg.includes('authentication failed')) {
          if (config.type === 'GMAIL') {
            errorMessage = 'Gmail-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihr App-Passwort.'
          } else if (config.type === 'ICLOUD') {
            errorMessage = 'iCloud-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein app-spezifisches Passwort (nicht Ihr normales iCloud-Passwort)\n2. Zwei-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. iCloud-E-Mail-Adresse ist vollständig (z.B. name@icloud.com)'
          } else {
            errorMessage = 'Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre SMTP-Zugangsdaten.'
          }
        } else if (errorCode === 'ECONNECTION' || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
          if (config.type === 'ICLOUD') {
            errorMessage = 'Verbindung zum iCloud-Server fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Internetverbindung\n2. Firewall-Einstellungen\n3. Port 587 ist nicht blockiert'
          } else {
            errorMessage = 'Verbindung zum Server fehlgeschlagen.'
          }
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
