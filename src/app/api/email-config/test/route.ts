import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Mailjet from 'node-mailjet'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Detaillierte Fehleranalyse für SMTP (inkl. Office 365). */
function buildSmtpErrorAnalysis(
  err: unknown,
  config: { type: string; smtpHost?: string | null; email?: string }
): { message: string; analysis: string; code?: string; responseCode?: string; response?: string } {
  const code = (err as { code?: string })?.code ?? ''
  const responseCode = String((err as { responseCode?: number })?.responseCode ?? '')
  const response = (err as { response?: string })?.response ?? ''
  const errMsg = err instanceof Error ? err.message : String(err)
  const errMsgLower = errMsg.toLowerCase()

  const isOffice365 =
    config.type === 'IMAP' &&
    config.smtpHost?.toLowerCase().includes('office365')

  let message = errMsg
  let analysis = ''

  // EAUTH / 535 = Authentifizierung
  if (
    code === 'EAUTH' ||
    responseCode === '535' ||
    errMsgLower.includes('invalid login') ||
    errMsgLower.includes('authentication failed') ||
    errMsgLower.includes('auth')
  ) {
    if (config.type === 'GMAIL') {
      message = 'Gmail-Authentifizierung fehlgeschlagen.'
      analysis =
        '1. Verwenden Sie ein App-Passwort (nicht Ihr normales Passwort)\n2. 2-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort ohne Leerzeichen kopieren\n4. E-Mail-Adresse prüfen'
    } else if (config.type === 'ICLOUD') {
      message = 'iCloud-Authentifizierung fehlgeschlagen.'
      analysis =
        '1. App-spezifisches Passwort verwenden (nicht normales iCloud-Passwort)\n2. Zwei-Faktor-Authentifizierung aktivieren\n3. App-Passwort von appleid.apple.com erstellen\n4. E-Mail vollständig (z.B. name@icloud.com)'
    } else if (isOffice365) {
      message = 'Office 365 / Outlook: Authentifizierung fehlgeschlagen.'
      analysis =
        '1. E-Mail: Ihre vollständige Office-365-Adresse (z.B. name@firma.com)\n' +
        '2. Passwort: Bei aktivierter MFA ein App-Kennwort verwenden (Microsoft-Konto → Sicherheit → App-Kennwörter)\n' +
        '3. SMTP AUTH: Im Microsoft 365 Admin Center muss „Authentifizierter SMTP“ für Ihr Postfach aktiviert sein (Exchange Admin → Postfächer → Ihr Postfach → E-Mail-Apps)\n' +
        '4. Kein normales Passwort bei MFA – nur App-Kennwort funktioniert'
    } else {
      message = 'SMTP-Authentifizierung fehlgeschlagen.'
      analysis = 'Benutzername (E-Mail) und Passwort prüfen. Bei 2FA oft App-Kennwort nötig.'
    }
  }
  // Verbindung / Timeout / ECONNREFUSED / ENOTFOUND
  else if (
    code === 'ECONNECTION' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    errMsgLower.includes('connection') ||
    errMsgLower.includes('timeout') ||
    errMsgLower.includes('econnrefused') ||
    errMsgLower.includes('enotfound')
  ) {
    message = 'Verbindung zum SMTP-Server fehlgeschlagen.'
    if (isOffice365) {
      analysis =
        '1. Host: smtp.office365.com (ohne Tippfehler)\n' +
        '2. Port: 587\n' +
        '3. STARTTLS: muss aktiviert sein (Checkbox „STARTTLS-Verschlüsselung verwenden“)\n' +
        '4. Firewall/Netzwerk: Port 587 ausgehend erlauben\n' +
        '5. Falls auf Railway/Vercel: ausgehende SMTP-Verbindungen prüfen (evtl. blockiert)'
    } else {
      analysis =
        'Internetverbindung prüfen. Firewall: Port 587 (STARTTLS) oder 465 (SSL) ausgehend erlauben.'
    }
  }
  // TLS / Zertifikat
  else if (
    errMsgLower.includes('tls') ||
    errMsgLower.includes('certificate') ||
    errMsgLower.includes('self-signed') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    message = 'TLS-/Zertifikatsproblem.'
    analysis =
      'STARTTLS aktiviert? (Port 587). Bei Office 365: Checkbox „STARTTLS-Verschlüsselung verwenden“ muss an sein.'
  }
  // Sonst: Rohfehler + Hinweise
  else {
    analysis = `Technisch: ${code ? `Code ${code}` : ''} ${responseCode ? `Response ${responseCode}` : ''} ${response ? response.substring(0, 200) : ''}`.trim()
    if (isOffice365) {
      analysis +=
        '\n\nOffice 365: Host smtp.office365.com, Port 587, STARTTLS aktiviert. Bei MFA App-Kennwort verwenden. SMTP AUTH im Admin Center aktivieren.'
    }
  }

  return {
    message,
    analysis: analysis.trim(),
    code: code || undefined,
    responseCode: responseCode || undefined,
    response: response ? response.substring(0, 500) : undefined,
  }
}

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

    if (config.type === 'MAILJET' && (!config.mailjetApiKey || !config.mailjetApiSecret)) {
      return NextResponse.json(
        { error: 'Mailjet API Key und API Secret sind erforderlich' },
        { status: 400 }
      )
    }

    // Mailjet: Versand per Send API v3.1
    if (config.type === 'MAILJET') {
      try {
        const mailjet = Mailjet.apiConnect(config.mailjetApiKey!, config.mailjetApiSecret!)
        const request = mailjet.post('send', { version: 'v3.1' }).request({
          Messages: [
            {
              From: { Email: config.email, Name: 'Iftar Organizasyon Test' },
              To: [{ Email: testEmail, Name: testEmail }],
              Subject: 'Test-E-Mail von Iftar Organizasyon',
              TextPart: 'Dies ist eine Test-E-Mail. Wenn Sie diese Nachricht erhalten, funktioniert Ihre Mailjet-Konfiguration korrekt.',
              HTMLPart: '<p>Dies ist eine Test-E-Mail. Wenn Sie diese Nachricht erhalten, funktioniert Ihre Mailjet-Konfiguration korrekt.</p>',
            },
          ],
        })
        const result = await request
        const messageId = (result.body as { Messages?: { To?: { MessageID?: number }[] }[] })?.Messages?.[0]?.To?.[0]?.MessageID
        console.log('✅ Mailjet Test-E-Mail gesendet:', messageId)
        return NextResponse.json({
          success: true,
          message: 'Test-E-Mail erfolgreich gesendet',
          messageId: messageId != null ? String(messageId) : 'mailjet-sent',
        })
      } catch (error) {
        console.error('❌ Fehler beim Senden der Mailjet Test-E-Mail:', error)
        const details = error instanceof Error ? error.message : 'Unbekannter Fehler'
        return NextResponse.json(
          { error: 'Fehler beim Senden der Test-E-Mail', details },
          { status: 500 }
        )
      }
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
        // IMAP / Eigener Mailserver (inkl. Office 365)
        const port = config.smtpPort ?? 587
        const useStartTls = config.smtpUseStartTls === true
        const secure = !useStartTls && port === 465
        transporter = require('nodemailer').createTransport({
          host: config.smtpHost || 'smtp.gmail.com',
          port,
          secure,
          requireTLS: useStartTls,
          auth: {
            user: config.email,
            pass: config.password || config.appPassword || '',
          },
          ...(useStartTls && {
            tls: { rejectUnauthorized: true },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
          }),
        } as any)
        console.log('📧 SMTP-Transporter erstellt (IMAP/Office 365):', {
          host: config.smtpHost || 'smtp.gmail.com',
          port,
          secure,
          useStartTls: useStartTls || undefined,
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
      const { message: details, analysis, code: errCode, responseCode: respCode, response: resp } = buildSmtpErrorAnalysis(verifyError, config)
      return NextResponse.json(
        {
          error: 'Verbindungstest fehlgeschlagen',
          details,
          analysis,
          code: errCode,
          responseCode: respCode,
          response: resp,
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
      const { message: details, analysis, code: errCode, responseCode: respCode, response: resp } = buildSmtpErrorAnalysis(sendError, config)
      return NextResponse.json(
        {
          error: 'Fehler beim Senden der Test-E-Mail',
          details,
          analysis,
          code: errCode,
          responseCode: respCode,
          response: resp,
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
