import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production')

export interface AuditLogData {
  userId?: string | null
  userEmail?: string | null
  action: string // CREATE, UPDATE, DELETE, VIEW, CLICK, LOGIN, LOGOUT, etc.
  entityType?: string | null // GUEST, TASK, CHECKLIST, NOTE, CATEGORY, USER, etc.
  entityId?: string | null
  eventId?: string | null
  category?: string | null
  description?: string | null
  oldValues?: any // Wird zu JSON stringified
  newValues?: any // Wird zu JSON stringified
  ipAddress?: string | null
  userAgent?: string | null
  url?: string | null
  metadata?: any // Wird zu JSON stringified
}

export async function getUserIdFromRequest(request: NextRequest | null): Promise<{ userId: string | null; userEmail: string | null }> {
  if (!request) return { userId: null, userEmail: null }

  // Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  // Cookie: auth-token
  const cookieToken = request.cookies.get('auth-token')?.value || null

  const token = bearer || cookieToken
  if (!token) return { userId: null, userEmail: null }

  try {
    const { payload } = await jwtVerify(token, secret)
    const userId = (payload as any)?.userId
    const userEmail = (payload as any)?.email
    
    if (typeof userId === 'string') {
      return { userId, userEmail: typeof userEmail === 'string' ? userEmail : null }
    }
    return { userId: null, userEmail: null }
  } catch {
    return { userId: null, userEmail: null }
  }
}

function getClientIp(request: NextRequest | null): string | null {
  if (!request) return null
  
  // Prüfe verschiedene Header für IP-Adresse
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  return null
}

export async function createAuditLog(
  data: AuditLogData,
  request?: NextRequest | null
): Promise<void> {
  try {
    // Hole User-Info aus Request, falls nicht bereits gesetzt
    if (!data.userId && request) {
      const userInfo = await getUserIdFromRequest(request)
      data.userId = userInfo.userId
      data.userEmail = data.userEmail || userInfo.userEmail
    }

    // Hole IP und User-Agent aus Request
    if (request) {
      data.ipAddress = data.ipAddress || getClientIp(request)
      data.userAgent = data.userAgent || request.headers.get('user-agent') || null
      data.url = data.url || request.url || null
    }

    // Konvertiere Objekte zu JSON-Strings
    const oldValuesJson = data.oldValues ? JSON.stringify(data.oldValues) : null
    const newValuesJson = data.newValues ? JSON.stringify(data.newValues) : null
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null

    // Erstelle Audit-Log Eintrag
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        action: data.action,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        eventId: data.eventId || null,
        category: data.category || null,
        description: data.description || null,
        oldValues: oldValuesJson,
        newValues: newValuesJson,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        url: data.url || null,
        metadata: metadataJson,
      },
    })
  } catch (error) {
    // Logging-Fehler sollten die Hauptfunktion nicht beeinträchtigen
    console.error('Audit-Log Fehler:', error)
  }
}

// Helper-Funktionen für häufige Aktionen
export async function logCreate(
  entityType: string,
  entityId: string,
  newValues: any,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'CREATE',
    entityType,
    entityId,
    newValues,
    description: options?.description || `${entityType} erstellt`,
    ...options,
  }, request)
}

export async function logUpdate(
  entityType: string,
  entityId: string,
  oldValues: any,
  newValues: any,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'UPDATE',
    entityType,
    entityId,
    oldValues,
    newValues,
    description: options?.description || `${entityType} aktualisiert`,
    ...options,
  }, request)
}

export async function logDelete(
  entityType: string,
  entityId: string,
  oldValues: any,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'DELETE',
    entityType,
    entityId,
    oldValues,
    description: options?.description || `${entityType} gelöscht`,
    ...options,
  }, request)
}

export async function logView(
  entityType: string,
  entityId: string,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'VIEW',
    entityType,
    entityId,
    description: options?.description || `${entityType} angezeigt`,
    ...options,
  }, request)
}

export async function logClick(
  description: string,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'CLICK',
    description,
    ...options,
  }, request)
}

export async function logLogin(
  userId: string,
  userEmail: string,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'LOGIN',
    userId,
    userEmail,
    description: `Benutzer ${userEmail} hat sich eingeloggt`,
    ...options,
  }, request)
}

export async function logLogout(
  userId: string,
  userEmail: string,
  request?: NextRequest | null,
  options?: Partial<AuditLogData>
): Promise<void> {
  await createAuditLog({
    action: 'LOGOUT',
    userId,
    userEmail,
    description: `Benutzer ${userEmail} hat sich ausgeloggt`,
    ...options,
  }, request)
}
