import nodemailer from 'nodemailer'
import { prisma } from './prisma'

export interface EmailConfigData {
  type: 'GMAIL' | 'IMAP'
  email: string
  appPassword?: string
  password?: string
  smtpHost?: string
  smtpPort?: number
  imapHost?: string
  imapPort?: number
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
  })

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

export async function sendInvitationEmail(
  to: string,
  subject: string,
  htmlBody: string,
  acceptLink: string,
  declineLink: string,
  trackingPixelUrl: string
) {
  const transporter = await getEmailTransporter()
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

  const mailOptions = {
    from: `"Iftar Organizasyon" <${config.email}>`,
    to,
    subject,
    html: emailBody,
    text: htmlBody.replace(/<[^>]*>/g, ''), // Plain-Text-Version
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
      
      // Gmail-spezifische Fehler
      if (errorCode === 'EAUTH' || responseCode === '535' || errorMsg.includes('invalid login') || errorMsg.includes('authentication failed') || errorMsg.includes('invalid credentials') || errorMsg.includes('username and password not accepted')) {
        errorMessage = 'Gmail-Authentifizierung fehlgeschlagen. Bitte überprüfen Sie:\n\n1. Verwenden Sie ein App-Passwort (nicht Ihr normales Gmail-Passwort)\n2. 2-Faktor-Authentifizierung muss aktiviert sein\n3. App-Passwort wurde korrekt kopiert (keine Leerzeichen)\n4. E-Mail-Adresse ist korrekt'
      } else if (errorCode === 'ECONNECTION' || errorMsg.includes('connection') || errorMsg.includes('timeout') || errorMsg.includes('econnrefused') || errorMsg.includes('enotfound')) {
        errorMessage = 'Verbindung zum Gmail-Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und Firewall-Einstellungen.'
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
