// Helper-Funktion zum Senden von Push Notifications

export interface PushNotificationData {
  title: string
  body: string
  url?: string
  userId?: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
}

/**
 * Sendet eine Push Notification an alle oder einen spezifischen Benutzer
 * 
 * @param data - Notification Daten
 * @returns Promise mit Ergebnis (sent, failed, total)
 * 
 * @example
 * // An alle Benutzer senden
 * await sendPushNotification({
 *   title: 'Neuer Gast hinzugefügt',
 *   body: 'Ein neuer Gast wurde zur Liste hinzugefügt',
 *   url: '/dashboard/guests'
 * })
 * 
 * @example
 * // An spezifischen Benutzer senden
 * await sendPushNotification({
 *   title: 'Neue Aufgabe zugewiesen',
 *   body: 'Dir wurde eine neue Aufgabe zugewiesen',
 *   url: '/dashboard/tasks',
 *   userId: 'user-id-123'
 * })
 */
export async function sendPushNotification(
  data: PushNotificationData
): Promise<{ success: boolean; sent: number; failed: number; total: number }> {
  try {
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Fehler beim Senden der Notification')
    }

    return await response.json()
  } catch (error) {
    console.error('Push Notification Fehler:', error)
    throw error
  }
}

/**
 * Sendet eine Push Notification vom Server (Backend)
 * Diese Funktion kann direkt in API Routes verwendet werden
 * 
 * @param data - Notification Daten
 * @returns Promise mit Ergebnis
 */
export async function sendPushNotificationFromServer(
  data: PushNotificationData
): Promise<{ success: boolean; sent: number; failed: number; total: number }> {
  // Diese Funktion wird auf dem Server ausgeführt
  // Importiere webpush direkt
  const webpush = require('web-push')
  const { prisma } = require('@/lib/prisma')

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@iftar-organizasyon.de'
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  if (!vapidPrivateKey || !vapidPublicKey) {
    console.warn('VAPID Keys nicht konfiguriert - Push Notification wird nicht gesendet')
    return { success: false, sent: 0, failed: 0, total: 0 }
  }

  // Konfiguriere web-push
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

  try {
    // Hole Subscriptions aus der Datenbank
    const where: any = {}
    if (data.userId) {
      where.userId = data.userId
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where,
    })

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0, total: 0 }
    }

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      url: data.url || '/dashboard',
      data: { url: data.url || '/dashboard' },
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
    })

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          )
          .catch(async (error: any) => {
            // Wenn Subscription ungültig ist, entferne sie
            if (error.statusCode === 410 || error.statusCode === 404) {
              await prisma.pushSubscription
                .delete({
                  where: { endpoint: sub.endpoint },
                })
                .catch(() => {})
            }
            throw error
          })
      )
    )

    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return {
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    }
  } catch (error) {
    console.error('Push Notification Fehler:', error)
    return { success: false, sent: 0, failed: 0, total: 0 }
  }
}
