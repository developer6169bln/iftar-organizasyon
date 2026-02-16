/**
 * Client-seitige Auth-Hilfe: Token aus Cookie oder localStorage.
 * Wird für fetch mit Authorization-Header verwendet, damit die Session auch bei
 * Cookie-Problemen (z.B. Secure-Flag, SameSite) erhalten bleibt.
 */
export function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null
  const fromCookie = document.cookie.match(/auth-token=([^;]+)/)?.[1]?.trim()
  if (fromCookie) return fromCookie
  return localStorage.getItem('auth-token')?.trim() || null
}

/** Headers für authentifizierte API-Anfragen (Cookie + Bearer als Fallback). */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}
