# Push Notifications Setup

## VAPID Keys generieren

1. **Online Tool (Empfohlen):**
   - Gehe zu: https://web-push-codelab.glitch.me/
   - Klicke auf "Generate Keys"
   - Kopiere die **Public Key** und **Private Key**

2. **Oder mit Node.js:**
   ```bash
   npm install -g web-push
   web-push generate-vapid-keys
   ```

## Umgebungsvariablen setzen

Füge zu `.env` (lokal) und Railway Environment Variables hinzu:

```env
# VAPID Keys für Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=deine_public_key_hier
VAPID_PRIVATE_KEY=deine_private_key_hier
VAPID_EMAIL=mailto:deine-email@example.com
```

**Wichtig:**
- `NEXT_PUBLIC_*` Variablen sind im Frontend verfügbar
- `VAPID_PRIVATE_KEY` NUR im Backend (nie im Frontend!)
- Auf Railway: Diese Variablen in den Settings → Variables hinzufügen

## Datenbank-Migration ausführen

```bash
# Lokal
npx prisma migrate dev

# Auf Railway (nach Push)
# Die Migration wird automatisch beim Build ausgeführt
```

## Icons erstellen (Optional)

Erstelle Icons für Notifications:
- `/public/icon-192x192.png` (192x192px)
- `/public/badge-72x72.png` (72x72px)

Falls nicht vorhanden, werden Standard-Icons verwendet.

## Testen

1. Öffne das Dashboard
2. Scrolle zur "Push Notifications" Sektion
3. Klicke auf "Push Notifications aktivieren"
4. Erlaube Benachrichtigungen im Browser
5. Teste eine Notification über die API:

```bash
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "Dies ist eine Test-Benachrichtigung",
    "url": "/dashboard"
  }'
```

## Notification senden (Backend)

Beispiel in einer API Route:

```typescript
import { sendPushNotification } from '@/lib/pushNotifications'

// Sende an alle Benutzer
await sendPushNotification({
  title: 'Neuer Gast hinzugefügt',
  body: `Gast "${guest.name}" wurde zur Liste hinzugefügt`,
  url: '/dashboard/guests',
})
```

## Funktionalität

- ✅ Service Worker registriert sich automatisch
- ✅ Subscriptions werden in der Datenbank gespeichert
- ✅ Notifications funktionieren auch wenn App geschlossen ist
- ✅ Click auf Notification öffnet die App
- ✅ Ungültige Subscriptions werden automatisch entfernt
