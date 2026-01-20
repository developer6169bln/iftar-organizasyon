# Railway Troubleshooting

## Build-Fehler beheben

### Problem: Build schlägt fehl beim `npm run build`

**Mögliche Ursachen:**

1. **DATABASE_URL nicht gesetzt**
   - Railway setzt `DATABASE_URL` automatisch, aber nur wenn:
     - PostgreSQL Service im gleichen Projekt ist
     - Beide Services verbunden sind

2. **Migration schlägt fehl**
   - Prisma kann nicht zur Datenbank verbinden
   - Oder Migration ist bereits ausgeführt

---

## Lösung 1: DATABASE_URL prüfen

### In Railway:

1. Gehe zu deinem **Web Service** (nicht PostgreSQL)
2. Klicke auf Tab **"Variables"**
3. Prüfe, ob `DATABASE_URL` vorhanden ist
4. Falls **NICHT vorhanden**:
   - Gehe zu deinem **PostgreSQL Service**
   - Klicke auf Tab **"Variables"**
   - Kopiere die `DATABASE_URL`
   - Gehe zurück zu **Web Service** → **Variables**
   - Klicke **"+ New Variable"**
   - Name: `DATABASE_URL`
   - Value: Die kopierte URL
   - Klicke **"Add"**

### Alternative: Services verbinden

1. In deinem **Web Service**
2. Tab **"Settings"**
3. Scrolle zu **"Service Dependencies"**
4. Klicke **"+ Add Service"**
5. Wähle deinen **PostgreSQL Service**
6. Railway verbindet automatisch die Services

---

## Lösung 2: Build-Script anpassen

Falls Migrationen fehlschlagen, können wir das Build-Script anpassen:

**Aktuell:**
```json
"build": "prisma generate && prisma migrate deploy && next build"
```

**Robuster (Migration optional):**
```json
"build": "prisma generate && (prisma migrate deploy || true) && next build"
```

Dies führt die Migration aus, aber bricht nicht ab, falls sie fehlschlägt.

---

## Lösung 3: Migration manuell ausführen

Falls der Build ohne Migration funktioniert:

1. **Railway CLI installieren:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Projekt verbinden:**
   ```bash
   railway link
   ```

4. **Migration ausführen:**
   ```bash
   railway run npx prisma migrate deploy
   ```

---

## Lösung 4: Build ohne Migration

Falls Migrationen Probleme machen:

1. Ändere `package.json`:
   ```json
   "build": "prisma generate && next build"
   ```

2. Migration später manuell ausführen (siehe Lösung 3)

---

## Prüfen ob DATABASE_URL gesetzt ist

### In Railway Build-Logs:

Suche nach:
```
DATABASE_URL=postgresql://...
```

Falls nicht vorhanden → DATABASE_URL ist nicht gesetzt!

### In Railway Dashboard:

1. Web Service → Variables
2. Prüfe, ob `DATABASE_URL` existiert
3. Falls nicht → manuell hinzufügen (siehe Lösung 1)

---

## Häufige Fehler

### "Can't reach database server"
- DATABASE_URL nicht gesetzt
- PostgreSQL Service nicht aktiv
- Services nicht verbunden

### "Migration already applied"
- Normal - Migration wurde bereits ausgeführt
- Build sollte trotzdem funktionieren

### "Schema engine error"
- DATABASE_URL falsch formatiert
- Datenbank nicht erreichbar
- Firewall blockiert Verbindung

---

## Empfohlene Lösung

1. **Prüfe DATABASE_URL** in Web Service → Variables
2. **Falls nicht vorhanden:** Manuell hinzufügen (von PostgreSQL Service kopieren)
3. **Services verbinden:** Web Service → Settings → Service Dependencies
4. **Redeploy:** Klicke auf "Redeploy"

---

## Schnelltest

Führe lokal aus (mit Railway DATABASE_URL):

```bash
export DATABASE_URL="postgresql://..." # Von Railway kopieren
npm run build
```

Falls lokal funktioniert → Problem ist Railway-Konfiguration
Falls lokal auch fehlschlägt → Problem ist im Code
