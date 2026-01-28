import nodemailer from 'nodemailer'
import { prisma } from './prisma'

export interface EmailConfigData {
  type: 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILGUN'
  email: string
  appPassword?: string
  password?: string
  smtpHost?: string
  smtpPort?: number
  imapHost?: string
  imapPort?: number
  mailgunDomain?: string
  mailgunApiKey?: string
  mailgunRegion?: string
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
    mailgunDomain: config.mailgunDomain,
    mailgunRegion: config.mailgunRegion,
  })

  // Mailgun verwendet HTTP API, kein SMTP-Transporter
  if (config.type === 'MAILGUN') {
    console.log('📧 Mailgun-Konfiguration erkannt - verwendet HTTP API (kein SMTP-Transporter)')
    return null // Kein Transporter für Mailgun
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
    // IMAP/SMTP Konfiguration
    transporter = nodemailer.createTransport({
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

  // KEIN verify() mehr - kann zu Timeouts führen
  // Die Verbindung wird beim tatsächlichen sendMail() getestet
  console.log('✅ Email-Transporter erstellt (Verbindungstest wird beim Senden durchgeführt)')

  return transporter
}

// Mailgun HTTP API Versand
async function sendViaMailgun(
  config: any,
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<{ success: true; messageId: string }> {
  if (!config.mailgunDomain || !config.mailgunApiKey) {
    throw new Error('Mailgun Domain oder API Key fehlt')
  }

  const region = config.mailgunRegion || 'US'
  const apiBaseUrl = region === 'EU' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
  const apiUrl = `${apiBaseUrl}/${config.mailgunDomain}/messages`

  // Basic Auth: Benutzer = "api", Passwort = API Key
  const auth = Buffer.from(`api:${config.mailgunApiKey}`).toString('base64')

  const formData = new URLSearchParams()
  formData.append('from', `"Iftar Organizasyon" <${config.email}>`)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('html', htmlBody)
  formData.append('text', textBody)

  console.log('📧 Mailgun API Request:', {
    url: apiUrl,
    domain: config.mailgunDomain,
    region,
    from: config.email,
    to,
  })

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Mailgun API Fehler:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    })

    let errorMessage = `Mailgun API Fehler: ${response.status} ${response.statusText}`
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.message) {
        errorMessage = `Mailgun: ${errorJson.message}`
      }
    } catch {
      // Ignoriere Parse-Fehler
    }

    throw new Error(errorMessage)
  }

  const result = await response.json()
  console.log('✅ Mailgun Email erfolgreich gesendet:', result.id || result.message)
  return { success: true, messageId: result.id || result.message || 'mailgun-sent' }
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

  // Mailgun verwendet HTTP API statt SMTP
  if (config.type === 'MAILGUN') {
    try {
      console.log('📧 Versuche E-Mail via Mailgun API zu senden an:', to)
      console.log('📧 Von:', config.email)
      console.log('📧 Betreff:', subject)

      const result = await sendViaMailgun(config, to, subject, emailBody, textBody)
      return result
    } catch (error) {
      console.error('❌ Mailgun Email-Versand fehlgeschlagen:', error)

      let errorMessage = 'Fehler beim Senden der E-Mail via Mailgun'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      throw new Error(errorMessage)
    }
  }

  // SMTP-basierte Versand (Gmail, iCloud, IMAP)
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
