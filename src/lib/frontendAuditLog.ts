// Frontend-Helper für Audit-Logging von Clicks und Aktionen

export async function logClick(
  description: string,
  metadata?: {
    entityType?: string
    entityId?: string
    eventId?: string
    category?: string
    url?: string
    [key: string]: any
  }
): Promise<void> {
  try {
    // Hole Token aus localStorage oder Cookie
    const token = localStorage.getItem('auth-token') || 
      document.cookie.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1]

    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'CLICK',
        description,
        url: window.location.pathname,
        ...metadata,
      }),
    })
  } catch (error) {
    // Logging-Fehler sollten die Hauptfunktion nicht beeinträchtigen
    console.error('Frontend Audit-Log Fehler:', error)
  }
}

// React Hook für Click-Logging
export function useAuditLog() {
  const logClickAction = (description: string, metadata?: any) => {
    logClick(description, metadata)
  }

  return { logClick: logClickAction }
}
