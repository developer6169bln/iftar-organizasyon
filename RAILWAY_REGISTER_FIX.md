# 🔧 Railway Registrierungs-Fehler beheben

## Problem
500 Internal Server Error bei `/api/auth/register`

## Mögliche Ursachen

### 1. DATABASE_URL nicht gesetzt ⚠️ (Häufigste Ursache)

**Prüfen:**
1. Railway Dashboard → Web Service → Variables
2. Prüfe, ob `DATABASE_URL` vorhanden ist

**Lösung:**
1. Gehe zu PostgreSQL Service → Variables
2. Kopiere `DATABASE_URL`
3. Gehe zu Web Service → Variables
4. Füge `DATABASE_URL` hinzu

---

### 2. Tabellen fehlen (Migrationen nicht ausgeführt)

**Prüfen:**
Rufe auf: `https://iftar-organizasyon-production.up.railway.app/api/health`

Falls Fehler → Tabellen fehlen

**Lösung:**
```bash
# Railway CLI installieren
npm i -g @railway/cli

# Login
railway login

# Projekt verbinden
railway link

# Migration ausführen
railway run npx prisma migrate deploy
```

---

### 3. Services nicht verbunden

**Lösung:**
1. Web Service → Settings
2. "Service Dependencies"
3. "+ Add Service" → PostgreSQL Service wählen

---

## Debug-Endpoint verwenden

Nach dem Deployment, rufe auf:
```
POST https://iftar-organizasyon-production.up.railway.app/api/debug/register
Body: { "email": "test@test.com", "name": "Test", "password": "test123" }
```

Das zeigt:
- Ob DATABASE_URL gesetzt ist
- Ob Datenbankverbindung funktioniert
- Ob Tabellen existieren
- Detaillierte Fehlermeldungen

---

## Schnellste Lösung

### Schritt 1: DATABASE_URL prüfen
1. Railway → Web Service → Variables
2. Prüfe ob `DATABASE_URL` existiert
3. Falls nicht → von PostgreSQL Service kopieren

### Schritt 2: Migrationen ausführen
```bash
railway run npx prisma migrate deploy
```

### Schritt 3: Redeploy
1. Railway → Web Service → Redeploy
2. Warte auf Build
3. Teste Registrierung erneut

---

## Prüfen in Railway Logs

1. Railway Dashboard → Web Service
2. Tab "Deployments" → Neuester Deployment
3. Klicke auf "View Logs"
4. Suche nach Fehlermeldungen:
   - "DATABASE_URL"
   - "Can't reach database"
   - "Table does not exist"
   - "P1001", "P2025" (Prisma Fehlercodes)

---

## Häufige Prisma Fehlercodes

- **P1001**: Datenbank nicht erreichbar → DATABASE_URL prüfen
- **P2025**: Tabelle nicht gefunden → Migrationen ausführen
- **P2002**: Unique constraint → E-Mail bereits vorhanden (normal)

---

## Checkliste

- [ ] DATABASE_URL in Web Service Variables vorhanden
- [ ] Services verbunden (Service Dependencies)
- [ ] Migrationen ausgeführt (`prisma migrate deploy`)
- [ ] Build erfolgreich
- [ ] Health-Check funktioniert (`/api/health`)

---

## Nächste Schritte

1. **Prüfe Railway Logs** für detaillierte Fehlermeldung
2. **Rufe `/api/health` auf** um Datenbankstatus zu prüfen
3. **Falls DATABASE_URL fehlt:** Siehe RAILWAY_QUICK_FIX.md
4. **Falls Tabellen fehlen:** Migrationen ausführen
