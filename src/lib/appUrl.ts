import type { NextRequest } from 'next/server'

/**
 * Basis-URL für Links in E-Mails (Zusage/Absage). Niemals localhost verwenden,
 * damit Empfänger mit einem Klick bestätigen können.
 * Priorität: NEXT_PUBLIC_BASE_URL → APP_URL → VERCEL_URL → Host-Header (wenn nicht localhost).
 */
export function getBaseUrlForInvitationEmails(request: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (envBase) return envBase.replace(/\/$/, '')

  const appUrl = process.env.APP_URL?.trim()
  if (appUrl) return appUrl.replace(/\/$/, '')

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL
  if (railwayDomain) return `https://${railwayDomain.replace(/\/$/, '')}`

  const origin = request.nextUrl?.origin
  if (origin && !origin.includes('localhost')) return origin

  const headerOrigin = request.headers.get('origin')
  if (headerOrigin && !headerOrigin.includes('localhost')) return headerOrigin

  const host = request.headers.get('host')
  if (host && !host.includes('localhost')) {
    const protocol = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
    return `${protocol}://${host}`
  }

  if (origin) return origin
  console.warn('⚠️ Keine App-URL für E-Mail-Links gefunden – setzen Sie NEXT_PUBLIC_BASE_URL (z. B. auf Railway). Links könnten localhost enthalten.')
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}
