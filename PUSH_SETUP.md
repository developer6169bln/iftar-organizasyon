# Push Notifications Setup

## VAPID Keys generieren

### Option 1: Mit dem Projekt-Script (Empfohlen)
```bash
npm run generate-vapid-keys
```

Das Script generiert die Keys und zeigt sie direkt an. Kopiere sie dann in deine Umgebungsvariablen.

### Option 2: Mit web-push CLI
```bash
# Global installieren (falls noch nicht geschehen)
npm install -g web-push

# Keys generieren
web-push generate-vapid-keys
```

### Option 3: Online Tool
- Gehe zu: https://vapidkeys.com/
- Oder: https://www.stephane-quantin.com/en/tools/generate/vapid-keys
- Kopiere die **Public Key** und **Private Key**

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
