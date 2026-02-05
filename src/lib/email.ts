import nodemailer from 'nodemailer'
import Mailjet from 'node-mailjet'
import { prisma } from './prisma'

export interface EmailConfigData {
  type: 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILJET'
  email: string
  appPassword?: string
  password?: string
  smtpHost?: string
  smtpPort?: number
  imapHost?: string
  imapPort?: number
  mailjetApiKey?: string
  mailjetApiSecret?: string
}

export async function getEmailTransporter() {
  const config = await prisma.emailConfig.findFirst({
    where: { isActive: true },
  })

  if (!config) {
    throw new Error('Keine aktive Email-Konfiguration gefunden')
  }

  // Logge Konfiguration (ohne Passwort)
  console.log('📧 Email-Konfiguration:', {
    type: config.type,
    email: config.email,
    hasAppPassword: !!config.appPassword,
    hasPassword: !!config.password,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    hasMailjetKey: config.type === 'MAILJET' ? !!config.mailjetApiKey : undefined,
  })

  // Mailjet verwendet HTTP API, kein SMTP-Transporter
  if (config.type === 'MAILJET') {
    console.log('📧 Mailjet-Konfiguration – verwendet HTTP API (kein SMTP-Transporter)')
    return null
  }

  let transporter

  if (config.type === 'GMAIL') {
    // Gmail mit App-Passwort
    const password = config.appPassword || config.password || ''
    
    if (!password) {
      throw new Error('Gmail-App-Passwort fehlt. Bitte erstellen Sie ein App-Passwort in Ihrem Google-Konto.')
    }
    
    // Verwende explizite SMTP-Konfiguration für Gmail (zuverlässiger als 'service: gmail')
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true für 465, false für andere Ports
      auth: {
        user: config.email,
        pass: password,
      },
      tls: {
        // Erlaube selbst-signierte Zertifikate nicht (Gmail hat gültige Zertifikate)
        rejectUnauthorized: true,
      },
    } as any)
    
    console.log('📧 Gmail-Transporter erstellt (SMTP) für:', config.email)
  } else if (config.type === 'ICLOUD') {
    // iCloud Mail mit App-spezifischem Passwort
    const password = config.appPassword || config.password || ''
    
    if (!password) {
      throw new Error('iCloud App-Passwort fehlt. Bitte erstellen Sie ein app-spezifisches Passwort in Ihren iCloud-Einstellungen.')
    }
    
    // Stelle sicher, dass die E-Mail-Adresse vollständig ist
    const emailAddress = (config.email || '').trim()
    if (!emailAddress || !emailAddress.includes('@')) {
      throw new Error('Ungültige iCloud-E-Mail-Adresse. Bitte verwenden Sie eine vollständige Adresse (z.B. name@icloud.com)')
    }
    
    // iCloud SMTP-Konfiguration
    // Port 587: STARTTLS (secure=false + requireTLS=true)
    // Port 465: SSL/TLS (secure=true)
    const smtpHost = config.smtpHost || 'smtp.mail.me.com'
    const smtpPort = config.smtpPort || 587
    const secure = smtpPort === 465
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: !secure, // erzwingt STARTTLS auf 587
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
    // IMAP/SMTP Konfiguration (eigener Mailserver)
    const port = config.smtpPort || 587
    const useStartTls = config.smtpUseStartTls === true
    const secure = !useStartTls && port === 465
    transporter = nodemailer.createTransport({
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
      }),
    } as any)
    
    console.log('📧 SMTP-Transporter erstellt:', {
      host: config.smtpHost || 'smtp.gmail.com',
      port,
      secure,
      useStartTls: useStartTls || undefined,
    })
  }

  // KEIN verify() mehr - kann zu Timeouts führen
  // Die Verbindung wird beim tatsächlichen sendMail() getestet
  console.log('✅ Email-Transporter erstellt (Verbindungstest wird beim Senden durchgeführt)')

  return transporter
}

// Mailjet-Versand per Send API v3.1
async function sendViaMailjet(
  config: { email: string; mailjetApiKey?: string | null; mailjetApiSecret?: string | null },
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<{ success: true; messageId: string }> {
  if (!config.mailjetApiKey || !config.mailjetApiSecret) {
    throw new Error('Mailjet API Key und API Secret sind erforderlich')
  }

  const mailjet = Mailjet.apiConnect(config.mailjetApiKey, config.mailjetApiSecret)

  const request = mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: config.email, Name: 'Iftar Organizasyon' },
        To: [{ Email: to, Name: to }],
        Subject: subject,
        TextPart: textBody,
        HTMLPart: htmlBody,
      },
    ],
  })

  const result = await request
  const messageId = (result.body as { Messages?: { To?: { MessageID?: number }[] }[] })?.Messages?.[0]?.To?.[0]?.MessageID
  const idStr = messageId != null ? String(messageId) : 'mailjet-sent'
  console.log('✅ Mailjet E-Mail gesendet:', idStr)
  return { success: true, messageId: idStr }
}

/** Mailjet-Versand mit PDF-Anhang (Base64). */
async function sendViaMailjetWithAttachment(
  config: { email: string; mailjetApiKey?: string | null; mailjetApiSecret?: string | null },
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  attachment: { filename: string; content: Buffer }
): Promise<{ success: true; messageId: string }> {
  if (!config.mailjetApiKey || !config.mailjetApiSecret) {
    throw new Error('Mailjet API Key und API Secret sind erforderlich')
  }
  const mailjet = Mailjet.apiConnect(config.mailjetApiKey, config.mailjetApiSecret)
  const base64Content = attachment.content.toString('base64')
  const request = mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: config.email, Name: 'UID BERLIN EVENTS' },
        To: [{ Email: to, Name: to }],
        Subject: subject,
        TextPart: textBody,
        HTMLPart: htmlBody,
        Attachments: [
          {
            ContentType: 'application/pdf',
            Filename: attachment.filename,
            Base64Content: base64Content,
          },
        ],
      },
    ],
  })
  const result = await request
  const messageId = (result.body as { Messages?: { To?: { MessageID?: number }[] }[] })?.Messages?.[0]?.To?.[0]?.MessageID
  const idStr = messageId != null ? String(messageId) : 'mailjet-sent'
  console.log('✅ Mailjet E-Mail mit Anhang gesendet:', idStr)
  return { success: true, messageId: idStr }
}

/** E-Mail mit PDF-Anhang (z. B. Check-in-QR-PDF an Hauptgast). */
export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string | undefined,
  attachment: { filename: string; content: Buffer }
): Promise<{ success: true; messageId?: string }> {
  const config = await prisma.emailConfig.findFirst({
    where: { isActive: true },
  })
  if (!config) {
    throw new Error('Keine aktive Email-Konfiguration')
  }
  const text = textBody ?? htmlBody.replace(/<[^>]*>/g, '')

  if (config.type === 'MAILJET') {
    return sendViaMailjetWithAttachment(config, to, subject, htmlBody, text, attachment)
  }

  const transporter = await getEmailTransporter()
  if (!transporter) {
    throw new Error('Email-Transporter konnte nicht erstellt werden')
  }
  const mailOptions = {
    from: `"UID BERLIN EVENTS" <${config.email}>`,
    to,
    subject,
    html: htmlBody,
    text,
    attachments: [{ filename: attachment.filename, content: attachment.content }],
  }
  const info = await transporter.sendMail(mailOptions)
  return { success: true, messageId: info.messageId }
}

/** Einfacher E-Mail-Versand (z. B. Passwort-Reset). */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<{ success: true; messageId?: string }> {
  const config = await prisma.emailConfig.findFirst({
    where: { isActive: true },
  })

  if (!config) {
    throw new Error('Keine aktive Email-Konfiguration')
  }

  const text = textBody ?? htmlBody.replace(/<[^>]*>/g, '')

  if (config.type === 'MAILJET') {
    const result = await sendViaMailjet(config, to, subject, htmlBody, text)
    return result
  }

  const transporter = await getEmailTransporter()
  if (!transporter) {
    throw new Error('Email-Transporter konnte nicht erstellt werden')
  }

  const mailOptions = {
    from: `"Iftar Organizasyon" <${config.email}>`,
    to,
    subject,
    html: htmlBody,
    text,
  }

  const info = await transporter.sendMail(mailOptions)
  return { success: true, messageId: info.messageId }
}

export async function sendInvitationEmail(
  to: string,
  subject: string,
  htmlBody: string,
  acceptLink: string,
  declineLink: string,
  trackingPixelUrl: string
) {
  const config = await prisma.emailConfig.findFirst({
    where: { isActive: true },
  })

  if (!config) {
    throw new Error('Keine aktive Email-Konfiguration')
  }

  // Füge Tracking-Pixel und Links zum HTML-Body hinzu
  const emailBody = htmlBody
    .replace('{{ACCEPT_LINK}}', acceptLink)
    .replace('{{DECLINE_LINK}}', declineLink)
    + `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`

  const textBody = htmlBody.replace(/<[^>]*>/g, '') // Plain-Text-Version

  // Mailjet: HTTP API statt SMTP
  if (config.type === 'MAILJET') {
    try {
      console.log('📧 Versuche E-Mail via Mailjet API an:', to)
      const result = await sendViaMailjet(config, to, subject, emailBody, textBody)
      return result
    } catch (error) {
      console.error('❌ Mailjet E-Mail-Versand fehlgeschlagen:', error)
      const msg = error instanceof Error ? error.message : 'Fehler beim Senden der E-Mail via Mailjet'
      throw new Error(msg)
    }
  }

  // SMTP-basierter Versand (Gmail, iCloud, IMAP)
  const transporter = await getEmailTransporter()
  if (!transporter) {
    throw new Error('Email-Transporter konnte nicht erstellt werden')
  }

  const mailOptions = {
    from: `"Iftar Organizasyon" <${config.email}>`,
    to,
    subject,
    html: emailBody,
    text: textBody,
  }

  try {
    console.log('📧 Versuche E-Mail zu senden an:', to)
    console.log('📧 Von:', config.email)
    console.log('📧 Betreff:', subject)
    
    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email erfolgreich gesendet:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Email-Versand fehlgeschlagen:', error)
    
    // Detailliertes Logging für Debugging
    if (error instanceof Error) {
      console.error('❌ Fehler-Details:', {
        message: error.message,
        code: (error as any).code,
        command: (error as any).command,
        response: (error as any).response,
        responseCode: (error as any).responseCode,
      })
    }
    
    // Erstelle eine benutzerfreundliche Fehlermeldung
    let errorMessage = 'Unbekannter Fehler beim Senden der E-Mail'
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase()
      const errorCode = (error as any).code || ''
      const responseCode = (error as any).responseCode || ''
      
      // Authentifizierungsfehler (Gmail/iCloud/IMAP)
      if (errorCode === 'EAUTH' || responseCode === '535' || errorMsg.includes('invalid login') || errorMsg.includes('authentication failed') || errorMsg.includes('invalid credentials') || errorMsg.includes('username and password not accepted')) {
        if (config.type === 'GMAIL') {
          errorMessage = 'Gmail-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein App-Passwort (nicht Ihr normales Gmail-Passwort)\n2. 2-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. E-Mail-Adresse ist korrekt'
        } else if (config.type === 'ICLOUD') {
          errorMessage = 'iCloud-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein app-spezifisches Passwort (nicht Ihr normales iCloud-Passwort)\n2. Zwei-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. iCloud-E-Mail-Adresse ist vollständig (z.B. name@icloud.com)'
        } else {
          errorMessage = 'Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre SMTP-Zugangsdaten.'
        }
      } else if (errorCode === 'ECONNECTION' || errorMsg.includes('connection') || errorMsg.includes('timeout') || errorMsg.includes('econnrefused') || errorMsg.includes('enotfound')) {
        if (config.type === 'ICLOUD') {
          errorMessage = 'Verbindung zum iCloud-Server fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Internetverbindung\n2. Firewall-Einstellungen\n3. Port 587 ist nicht blockiert\n4. smtp.mail.me.com ist erreichbar'
        } else if (config.type === 'GMAIL') {
          errorMessage = 'Verbindung zum Gmail-Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und Firewall-Einstellungen.'
        } else {
          errorMessage = 'Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und Firewall-Einstellungen.'
        }
      } else if (errorMsg.includes('self signed certificate') || errorMsg.includes('certificate') || errorMsg.includes('unable to verify')) {
        errorMessage = 'SSL/TLS-Zertifikatsfehler. Bitte überprüfen Sie Ihre SMTP-Einstellungen.'
      } else if (errorMsg.includes('rate limit') || errorMsg.includes('quota') || responseCode === '550') {
        errorMessage = 'Gmail-Limit erreicht. Bitte versuchen Sie es später erneut oder überprüfen Sie Ihr Gmail-Konto auf Einschränkungen.'
      } else if (responseCode === '553' || errorMsg.includes('sender address')) {
        errorMessage = 'Absender-Adresse ungültig. Bitte überprüfen Sie die E-Mail-Adresse in der Konfiguration.'
      } else if (responseCode === '550' || errorMsg.includes('recipient')) {
        errorMessage = 'Empfänger-Adresse ungültig. Bitte überprüfen Sie die E-Mail-Adresse des Empfängers.'
      } else {
        errorMessage = `${error.message}${errorCode ? ` (Code: ${errorCode})` : ''}${responseCode ? ` (Response: ${responseCode})` : ''}`
      }
    }
    
    const enhancedError = new Error(errorMessage)
    if (error instanceof Error) {
      enhancedError.stack = error.stack
    }
    throw enhancedError
  }
}
