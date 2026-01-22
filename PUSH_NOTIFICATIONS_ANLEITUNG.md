# Browser Push Notifications - Schritt-für-Schritt Anleitung

## Übersicht
Diese Anleitung zeigt, wie man native Browser Push Notifications in deiner Next.js-Anwendung implementiert.

## Voraussetzungen
- Next.js 16+ (bereits vorhanden ✓)
- HTTPS (für Production - Railway unterstützt das ✓)
- VAPID Keys (werden generiert)

---

## Schritt 1: VAPID Keys generieren

VAPID (Voluntary Application Server Identification) Keys sind notwendig, um Push Notifications zu senden.

### Option A: Mit dem Projekt-Script (Empfohlen)
```bash
npm run generate-vapid-keys
```

Das Script generiert die Keys und zeigt sie direkt an.

### Option B: Mit web-push CLI
```bash
npm install -g web-push
web-push generate-vapid-keys
```

### Option C: Online Tools
- https://vapidkeys.com/
- https://www.stephane-quantin.com/en/tools/generate/vapid-keys

**Wichtig:** Speichere beide Keys sicher! Du wirst sie für die Umgebungsvariablen brauchen.

---

## Schritt 2: Dependencies installieren

```bash
npm install web-push
```

---

## Schritt 3: Service Worker erstellen

Erstelle `/public/sw.js` (Service Worker):

```javascript
// Service Worker für Push Notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Neue Benachrichtigung';
  const options = {
    body: data.body || 'Du hast eine neue Nachricht',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Prüfe ob ein Fenster bereits geöffnet ist
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Öffne neues Fenster
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

---

## Schritt 4: Service Worker registrieren (Frontend)

Erstelle `/src/lib/pushNotifications.ts`:

```typescript
// Push Notifications Helper
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registriert:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker Registrierung fehlgeschlagen:', error);
      return null;
    }
  }
  return null;
}

export async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const { publicKey } = await response.json();
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    
    // Subscription an Server senden
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });
    
    return subscription;
  } catch (error) {
    console.error('Push Subscription fehlgeschlagen:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

---

## Schritt 5: API Route für Subscription

Erstelle `/src/app/api/push/subscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// VAPID Keys aus Umgebungsvariablen
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com';

// Konfiguriere web-push
webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey });
}

export async function POST(request: NextRequest) {
  try {
    const { subscription } = await request.json();
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription erforderlich' },
        { status: 400 }
      );
    }
    
    // Hier würdest du die Subscription in der Datenbank speichern
    // Für jetzt nur als Beispiel:
    console.log('Neue Subscription:', subscription);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription Fehler:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Subscription' },
      { status: 500 }
    );
  }
}
```

---

## Schritt 6: API Route zum Senden von Notifications

Erstelle `/src/app/api/push/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com';
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

export async function POST(request: NextRequest) {
  try {
    const { title, body, url, userId, icon } = await request.json();
    
    // Hole alle Subscriptions für den Benutzer (oder alle)
    // Hier müsstest du eine Subscription-Tabelle in der DB haben
    // Beispiel:
    // const subscriptions = await prisma.pushSubscription.findMany({
    //   where: userId ? { userId } : {}
    // });
    
    // Für jetzt: Hardcoded Subscription (später aus DB)
    const subscriptions = []; // TODO: Aus Datenbank laden
    
    const payload = JSON.stringify({
      title: title || 'Neue Benachrichtigung',
      body: body || 'Du hast eine neue Nachricht',
      icon: icon || '/icon-192x192.png',
      url: url || '/dashboard',
      data: { url: url || '/dashboard' }
    });
    
    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub, payload)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return NextResponse.json({
      success: true,
      sent: successful,
      failed
    });
  } catch (error) {
    console.error('Push Notification Fehler:', error);
    return NextResponse.json(
      { error: 'Fehler beim Senden der Notification' },
      { status: 500 }
    );
  }
}
```

---

## Schritt 7: Datenbank-Modell für Subscriptions

Füge zu `/prisma/schema.prisma` hinzu:

```prisma
model PushSubscription {
  id            String   @id @default(cuid())
  userId        String?  // Optional: Benutzer-ID
  endpoint      String   @unique
  p256dh        String
  auth          String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user          User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("push_subscriptions")
}
```

Und füge zur User-Model hinzu:
```prisma
pushSubscriptions PushSubscription[]
```

Dann Migration ausführen:
```bash
npx prisma migrate dev --name add_push_subscriptions
```

---

## Schritt 8: Frontend-Komponente für Push Setup

Erstelle `/src/components/PushNotificationSetup.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react';
import { registerServiceWorker, requestNotificationPermission, subscribeToPush } from '@/lib/pushNotifications';

export default function PushNotificationSetup() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      // 1. Service Worker registrieren
      const registration = await registerServiceWorker();
      if (!registration) {
        alert('Service Worker konnte nicht registriert werden');
        return;
      }

      // 2. Berechtigung anfragen
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        alert('Benachrichtigungen wurden nicht erlaubt');
        return;
      }

      // 3. Push Subscription erstellen
      const subscription = await subscribeToPush(registration);
      if (subscription) {
        setIsSubscribed(true);
        alert('Push Notifications erfolgreich aktiviert!');
      }
    } catch (error) {
      console.error('Fehler:', error);
      alert('Fehler beim Aktivieren der Notifications');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        Push Notifications werden von deinem Browser nicht unterstützt.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-4 text-lg font-semibold">Push Notifications</h3>
      {isSubscribed ? (
        <div className="text-green-600">
          ✓ Push Notifications sind aktiviert
        </div>
      ) : (
        <button
          onClick={handleEnableNotifications}
          disabled={isLoading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Wird aktiviert...' : 'Push Notifications aktivieren'}
        </button>
      )}
    </div>
  );
}
```

---

## Schritt 9: Umgebungsvariablen setzen

Füge zu `.env` hinzu:

```env
# VAPID Keys für Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=deine_public_key_hier
VAPID_PRIVATE_KEY=deine_private_key_hier
VAPID_EMAIL=mailto:deine-email@example.com
```

**Wichtig:** 
- `NEXT_PUBLIC_*` Variablen sind im Frontend verfügbar
- `VAPID_PRIVATE_KEY` NUR im Backend (nie im Frontend!)
- Auf Railway: Diese Variablen in den Settings hinzufügen

---

## Schritt 10: Icons erstellen

Erstelle Icons für Notifications:
- `/public/icon-192x192.png` (192x192px)
- `/public/badge-72x72.png` (72x72px)

---

## Schritt 11: Notifications senden (Backend)

Beispiel: Notification senden wenn ein Gast hinzugefügt wird:

```typescript
// In /src/app/api/guests/route.ts (POST)
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Nach dem Erstellen des Gastes:
const subscriptions = await prisma.pushSubscription.findMany({
  where: { userId: userInfo.userId } // Oder alle
});

const payload = JSON.stringify({
  title: 'Neuer Gast hinzugefügt',
  body: `Gast "${guest.name}" wurde zur Liste hinzugefügt`,
  icon: '/icon-192x192.png',
  url: '/dashboard/guests',
  data: { url: '/dashboard/guests' }
});

await Promise.allSettled(
  subscriptions.map(sub => 
    webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      },
      payload
    )
  )
);
```

---

## Zusammenfassung

1. ✅ VAPID Keys generieren
2. ✅ `web-push` installieren
3. ✅ Service Worker erstellen (`/public/sw.js`)
4. ✅ Push Helper Functions (`/src/lib/pushNotifications.ts`)
5. ✅ API Routes (`/api/push/subscribe`, `/api/push/send`)
6. ✅ Datenbank-Modell für Subscriptions
7. ✅ Frontend-Komponente für Setup
8. ✅ Umgebungsvariablen setzen
9. ✅ Icons erstellen
10. ✅ Notifications senden (in bestehenden API Routes)

---

## Nächste Schritte

- Subscription-Tabelle in DB erstellen
- UI-Komponente zum Dashboard hinzufügen
- Notifications bei wichtigen Events senden
- Notification-Historie speichern

Möchtest du, dass ich das jetzt implementiere?
