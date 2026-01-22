import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@iftar-organizasyon.de'

// GET: Public Key zurückgeben
export async function GET() {
  if (!vapidPublicKey) {
    return NextResponse.json(
      { error: 'VAPID Public Key nicht konfiguriert' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ publicKey: vapidPublicKey })
}

// POST: Subscription speichern
export async function POST(request: NextRequest) {
  try {
    const { subscription } = await request.json()
    
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Subscription erforderlich' },
        { status: 400 }
      )
    }
    
    // Hole User ID aus Request
    const userInfo = await getUserIdFromRequest(request)
    
    // Prüfe ob Subscription bereits existiert
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    })
    
    if (existing) {
      // Update bestehende Subscription
      await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userInfo.userId || null,
        },
      })
    } else {
      // Erstelle neue Subscription
      await prisma.pushSubscription.create({
        data: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userInfo.userId || null,
        },
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscription Fehler:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Subscription' },
      { status: 500 }
    )
  }
}

// DELETE: Subscription entfernen
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json()
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint erforderlich' },
        { status: 400 }
      )
    }
    
    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscription Löschen Fehler:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Subscription' },
      { status: 500 }
    )
  }
}
