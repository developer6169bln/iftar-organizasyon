# 🗄️ Migrationen auf Railway ausführen

## Problem
- Registrierung schlägt fehl, weil Tabellen nicht existieren (Migrationen nicht ausgeführt).
- **Login gibt 500 oder 503** mit Meldung „Datenbank-Migration fehlt“ → gleiche Lösung: Migrationen ausführen.

## Lösung: Migrationen ausführen

### Option 1: Railway CLI (Empfohlen)

```bash
# 1. Railway CLI installieren
npm i -g @railway/cli

# 2. Login
railway login

# 3. Projekt verbinden
railway link
# Wähle dein Projekt aus der Liste

# 4. Migrationen ausführen
railway run npx prisma migrate deploy
```

Das führt die Migrationen direkt auf Railway aus!

---

### Option 2: Über Railway Dashboard

1. **Railway Dashboard** → Dein Projekt
2. **Web Service** → Tab **"Deployments"**
3. Klicke auf **"..."** (drei Punkte) → **"Open Shell"**
4. Führe aus:
   ```bash
   npx prisma migrate deploy
   ```

---

### Option 3: Migration-Endpoint (nach Deployment)

Nach dem nächsten Deployment kannst du Migrationen über API ausführen:

```bash
# Migration-Status prüfen
GET https://iftar-organizasyon-production.up.railway.app/api/migrate

# Migrationen ausführen (nur in Development, oder mit Secret)
POST https://iftar-organizasyon-production.up.railway.app/api/migrate
Header: x-migrate-secret: DEIN_SECRET
```

**WICHTIG:** Setze `MIGRATE_SECRET` in Railway Variables für Sicherheit!

---

## Schritt-für-Schritt mit Railway CLI

### Schritt 1: CLI installieren
```bash
npm i -g @railway/cli
```

### Schritt 2: Login
```bash
railway login
```
- Öffnet Browser für Login

### Schritt 3: Projekt verbinden
```bash
railway link
```
- Wähle dein Projekt: `iftar-organizasyon`

### Schritt 4: Migrationen ausführen
```bash
railway run npx prisma migrate deploy
```

**Erwartete Ausgabe:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

Applying migration `20260119231419_init`
Applying migration `20260119233927_add_vip_to_guests`
Applying migration `20260119235100_add_reception_fields`
Applying migration `20260120040118_add_program_items`

All migrations have been successfully applied.
```

---

## Prüfen ob Migrationen erfolgreich waren

### Option 1: Health-Check
```
GET https://iftar-organizasyon-production.up.railway.app/api/health
```

Sollte zeigen:
```json
{
  "status": "ok",
  "database": "connected",
  "tables": {
    "users": "exists"
  }
}
```

### Option 2: Railway CLI
```bash
railway run npx prisma migrate status
```

### Option 3: In Supabase/Railway Database
- Gehe zu PostgreSQL Service
- Tab "Data" oder "Query"
- Führe aus: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
- Du solltest alle Tabellen sehen

---

## Checkliste

- [ ] Railway CLI installiert
- [ ] Eingeloggt (`railway login`)
- [ ] Projekt verbunden (`railway link`)
- [ ] DATABASE_URL gesetzt (in Web Service Variables)
- [ ] Migrationen ausgeführt (`railway run npx prisma migrate deploy`)
- [ ] Health-Check zeigt "connected"
- [ ] Registrierung funktioniert

---

## Nach Migrationen

1. **Health-Check prüfen:** `/api/health`
2. **Registrierung testen:** Sollte jetzt funktionieren!
3. **Tabellen prüfen:** In Railway Database Query

---

## 🆘 Falls Migrationen fehlschlagen

### Fehler: "Can't reach database"
- Prüfe DATABASE_URL in Web Service Variables
- Prüfe, ob PostgreSQL Service läuft

### Fehler: "Migration already applied"
- Das ist OK - Migrationen wurden bereits ausgeführt
- Prüfe Health-Check

### Fehler: "Table already exists"
- Tabellen existieren bereits
- Prüfe Health-Check

---

## ✅ Erfolg!

Nach erfolgreichen Migrationen:
- ✅ Tabellen existieren
- ✅ Health-Check zeigt "connected"
- ✅ Registrierung funktioniert
- ✅ Anwendung ist vollständig funktionsfähig!
