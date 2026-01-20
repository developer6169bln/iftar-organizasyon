# 🚨 Railway Build-Fehler - Schnelle Lösung

## Problem
Build schlägt fehl beim `npm run build` - wahrscheinlich weil `DATABASE_URL` nicht gesetzt ist.

---

## ✅ Lösung: DATABASE_URL in Railway setzen

### Schritt 1: DATABASE_URL von PostgreSQL Service kopieren

1. Gehe zu deinem **Railway Dashboard**
2. Klicke auf deinen **PostgreSQL Service** (nicht Web Service!)
3. Gehe zum Tab **"Variables"**
4. Finde `DATABASE_URL`
5. **Kopiere die komplette URL**

### Schritt 2: DATABASE_URL zu Web Service hinzufügen

1. Gehe zu deinem **Web Service** (nicht PostgreSQL!)
2. Gehe zum Tab **"Variables"**
3. Klicke auf **"+ New Variable"**
4. **Name:** `DATABASE_URL`
5. **Value:** Die URL, die du von PostgreSQL kopiert hast
6. Klicke auf **"Add"**

### Schritt 3: Services verbinden (wichtig!)

1. In deinem **Web Service**
2. Gehe zum Tab **"Settings"**
3. Scrolle nach unten zu **"Service Dependencies"**
4. Klicke auf **"+ Add Service"**
5. Wähle deinen **PostgreSQL Service**
6. Railway verbindet automatisch die Services

### Schritt 4: Redeploy

1. Gehe zu deinem **Web Service**
2. Klicke auf **"Deploy"** oder **"Redeploy"**
3. Warte auf den Build

---

## 🔍 Prüfen ob DATABASE_URL gesetzt ist

### In Railway Build-Logs:

Suche nach:
```
DATABASE_URL=postgresql://...
```

Falls **NICHT vorhanden** → DATABASE_URL ist nicht gesetzt!

### In Railway Dashboard:

1. **Web Service** → **Variables**
2. Prüfe, ob `DATABASE_URL` existiert
3. Falls **NICHT** → siehe Lösung oben

---

## ⚡ Alternative: Build ohne Migration

Falls Migrationen weiterhin Probleme machen:

1. Ändere `railway.json`:
   ```json
   {
     "build": {
       "buildCommand": "npm run build"
     }
   }
   ```

2. Migration später manuell ausführen:
   - Railway CLI installieren: `npm i -g @railway/cli`
   - `railway login`
   - `railway link`
   - `railway run npx prisma migrate deploy`

---

## 📋 Checkliste

- [ ] PostgreSQL Service erstellt
- [ ] DATABASE_URL in PostgreSQL Service vorhanden
- [ ] DATABASE_URL zu Web Service hinzugefügt
- [ ] Services verbunden (Service Dependencies)
- [ ] Redeploy ausgeführt
- [ ] Build erfolgreich

---

## 🎯 Wichtigste Schritte

1. **DATABASE_URL kopieren** (von PostgreSQL Service)
2. **DATABASE_URL hinzufügen** (zu Web Service)
3. **Services verbinden** (Service Dependencies)
4. **Redeploy**

Das sollte das Problem lösen! 🚀
