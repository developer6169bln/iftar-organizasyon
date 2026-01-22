# Push Notifications - Überprüfung

## ✅ Code-Implementierung (Alle vorhanden)

### 1. Service Worker
- ✅ `/public/sw.js` - Vorhanden und korrekt
- ✅ Push Event Handler implementiert
- ✅ Notification Click Handler implementiert
- ✅ Service Worker Install/Activate Events

### 2. Helper Functions
- ✅ `/src/lib/pushNotifications.ts` - Vorhanden
- ✅ `registerServiceWorker()` - Implementiert
- ✅ `requestNotificationPermission()` - Implementiert
- ✅ `subscribeToPush()` - Implementiert
- ✅ `unsubscribeFromPush()` - Implementiert
- ✅ `getSubscriptionStatus()` - Implementiert

### 3. API Routes
- ✅ `/api/push/subscribe` (GET, POST, DELETE) - Vorhanden
- ✅ `/api/push/send` (POST) - Vorhanden
- ✅ Fehlerbehandlung implementiert
- ✅ Datenbank-Integration vorhanden

### 4. Frontend Komponente
- ✅ `/src/components/PushNotificationSetup.tsx` - Vorhanden
- ✅ Dashboard Integration - ✅ Importiert in `/dashboard/page.tsx`
- ✅ UI für Aktivieren/Deaktivieren
- ✅ Status-Anzeige

### 5. Datenbank
- ✅ `PushSubscription` Model in Schema
- ✅ Migration vorhanden: `20260122000000_add_push_subscriptions`
- ✅ Relation zu User Model

### 6. Dependencies
- ✅ `web-push` installiert
- ✅ `@types/web-push` installiert

### 7. Build
- ✅ Keine Compile-Fehler
- ✅ Routes werden erkannt: `/api/push/send`, `/api/push/subscribe`

---

## ⚠️ Konfiguration (Muss geprüft werden)

### Umgebungsvariablen

**Lokal (.env):**
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:...
```

**Auf Railway:**
- Prüfe in Railway Dashboard → Variables
- Alle 3 Variablen müssen gesetzt sein

### Datenbank-Migration

**Lokal:**
```bash
npx prisma migrate dev
```

**Auf Railway:**
- Migration muss ausgeführt werden
- SQL: `/prisma/migrations/20260122000000_add_push_subscriptions/migration.sql`

---

## 🧪 Test-Checkliste

### 1. Service Worker Registrierung
- [ ] Öffne Dashboard
- [ ] Öffne Browser DevTools → Application → Service Workers
- [ ] Prüfe ob `/sw.js` registriert ist

### 2. Push Notification Setup
- [ ] Komponente wird im Dashboard angezeigt
- [ ] "Push Notifications aktivieren" Button sichtbar
- [ ] Klick öffnet Browser-Berechtigungsdialog
- [ ] Nach Erlauben: Status zeigt "aktiviert"

### 3. API Test
```bash
# Test Public Key abrufen
curl http://localhost:3000/api/push/subscribe

# Sollte zurückgeben:
# {"publicKey":"..."}
```

### 4. Notification senden (Test)
```bash
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "body": "Test Notification"
  }'
```

---

## 🔍 Häufige Probleme

### Problem: "VAPID Public Key nicht konfiguriert"
**Lösung:** Prüfe `.env` und Railway Variables

### Problem: Service Worker wird nicht registriert
**Lösung:** 
- Prüfe ob `/sw.js` im `public/` Ordner ist
- Prüfe Browser-Konsole auf Fehler
- HTTPS erforderlich (außer localhost)

### Problem: Subscription wird nicht gespeichert
**Lösung:**
- Prüfe Datenbank-Migration
- Prüfe API Route Logs
- Prüfe Browser Network Tab

---

## ✅ Status: Code ist korrekt implementiert!

Die Implementierung ist vollständig. Jetzt müssen nur noch:
1. VAPID Keys generiert werden
2. Umgebungsvariablen gesetzt werden
3. Datenbank-Migration ausgeführt werden
