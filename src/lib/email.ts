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

  let transporter

  if (config.type === 'GMAIL') {
    // Gmail mit App-Passwort
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email,
        pass: config.appPassword || config.password || '',
      },
    } as any)
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
  }

  // Teste Verbindung
  try {
    await transporter.verify()
    console.log('Email-Server Verbindung erfolgreich')
  } catch (error) {
    console.error('Email-Server Verbindung fehlgeschlagen:', error)
    throw new Error('Email-Server Verbindung fehlgeschlagen')
  }

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
    const info = await transporter.sendMail(mailOptions)
    console.log('Email gesendet:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email-Versand fehlgeschlagen:', error)
    throw error
  }
}
