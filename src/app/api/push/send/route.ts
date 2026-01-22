import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@iftar-organizasyon.de'
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Konfiguriere web-push
if (vapidPrivateKey && vapidPublicKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

export async function POST(request: NextRequest) {
  try {
    if (!vapidPrivateKey || !vapidPublicKey) {
      return NextResponse.json(
        { error: 'VAPID Keys nicht konfiguriert' },
        { status: 500 }
      )
    }
    
    const { title, body, url, userId, icon, tag, requireInteraction } = await request.json()
    
    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title und Body sind erforderlich' },
        { status: 400 }
      )
    }
    
    // Hole Subscriptions aus der Datenbank
    const where: any = {}
    if (userId) {
      where.userId = userId
    }
    
    const subscriptions = await prisma.pushSubscription.findMany({
      where,
    })
    
    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: 'Keine Subscriptions gefunden',
      })
    }
    
    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      url: url || '/dashboard',
      data: { url: url || '/dashboard' },
      tag: tag || 'default',
      requireInteraction: requireInteraction || false,
    })
    
    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        ).catch(async (error) => {
          // Wenn Subscription ungültig ist, entferne sie
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.delete({
              where: { endpoint: sub.endpoint },
            }).catch(() => {})
          }
          throw error
        })
      )
    )
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    })
  } catch (error) {
    console.error('Push Notification Fehler:', error)
    return NextResponse.json(
      { error: 'Fehler beim Senden der Notification' },
      { status: 500 }
    )
  }
}
