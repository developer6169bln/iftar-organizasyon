# 🚂 Railway Deployment - Schritt für Schritt

## Warum Railway?
- ✅ Alles in einem Dashboard
- ✅ PostgreSQL automatisch inklusive
- ✅ DATABASE_URL automatisch gesetzt
- ✅ Migrationen laufen automatisch
- ✅ Sehr einfaches Setup (~5 Minuten)

---

## 📋 Schritt-für-Schritt Anleitung

### Schritt 1: Railway Account erstellen

1. Gehe zu: https://railway.app
2. Klicke auf **"Start a New Project"** oder **"Login"**
3. Wähle **"Login with GitHub"**
4. Autorisiere Railway, auf dein GitHub zu zugreifen

---

### Schritt 2: Neues Projekt erstellen

1. Nach dem Login siehst du das Dashboard
2. Klicke auf **"+ New Project"**
3. Wähle **"Deploy from GitHub repo"**
4. Suche nach: `iftar-organizasyon`
5. Klicke auf das Repository
6. Railway startet automatisch das Deployment

---

### Schritt 3: PostgreSQL-Datenbank hinzufügen

1. In deinem Railway-Projekt, klicke auf **"+ New"**
2. Wähle **"Database"** → **"Add PostgreSQL"**
3. Railway erstellt automatisch eine PostgreSQL-Datenbank
4. **WICHTIG:** Railway setzt automatisch die `DATABASE_URL` Environment Variable! 🎉

---

### Schritt 4: Environment Variables prüfen/setzen

1. Klicke auf deinen **Web Service** (nicht die Datenbank)
2. Gehe zum Tab **"Variables"**
3. Prüfe, ob `DATABASE_URL` bereits gesetzt ist (sollte automatisch da sein)
4. Füge hinzu (falls nicht vorhanden):
   - **Name:** `JWT_SECRET`
   - **Value:** Ein langer, zufälliger String
     - Generiere einen: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - **Beispiel:** `c810a4248cc8280f45a71f891475392793e3d1d8f6635c4b0732563c2cfa4bb462c13683ad8b35fc2890cea374414743d9bfd4de6dfde01e2f017efeddd0adc6`
5. Klicke auf **"Add"**

---

### Schritt 5: Build Settings prüfen

Railway erkennt automatisch Next.js, aber prüfe:

1. Klicke auf deinen **Web Service**
2. Gehe zum Tab **"Settings"**
3. Prüfe:
   - **Build Command:** `npm run build` (sollte automatisch erkannt werden)
   - **Start Command:** `npm start` (sollte automatisch erkannt werden)
   - **Root Directory:** `.` (leer lassen oder `.`)

Falls nicht korrekt, setze:
- **Build Command:** `npm run build`
- **Start Command:** `npm start`

---

### Schritt 6: Deployment abwarten

1. Railway deployed automatisch
2. Du siehst die Build-Logs in Echtzeit
3. Warte, bis der Build fertig ist
4. Railway zeigt dir die URL: `https://iftar-organizasyon-production.up.railway.app`

---

### Schritt 7: Migrationen prüfen

In den Build-Logs solltest du sehen:
```
> prisma generate && prisma migrate deploy && next build
...
Datasource "db": PostgreSQL database ...
Applying migration `20260119231419_init`
Applying migration `20260119233927_add_vip_to_guests`
Applying migration `20260119235100_add_reception_fields`
Applying migration `20260120040118_add_program_items`
All migrations have been successfully applied.
```

---

## ✅ Checkliste

- [ ] Railway Account erstellt
- [ ] GitHub Repository verbunden
- [ ] Projekt erstellt
- [ ] PostgreSQL-Datenbank hinzugefügt
- [ ] `DATABASE_URL` automatisch gesetzt (prüfen!)
- [ ] `JWT_SECRET` Environment Variable gesetzt
- [ ] Build erfolgreich
- [ ] Migrationen erfolgreich ausgeführt
- [ ] Anwendung läuft auf Railway URL

---

## 🔍 Prüfen ob es funktioniert

### In Railway:

1. Gehe zu deinem **PostgreSQL Service**
2. Klicke auf **"Query"** Tab
3. Führe aus: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
4. Du solltest alle Tabellen sehen:
   - `users`
   - `events`
   - `guests`
   - `tasks`
   - `checklist_items`
   - `program_items`
   - etc.

### In der Anwendung:

1. Öffne die Railway URL: `https://iftar-organizasyon-production.up.railway.app`
2. Registriere einen neuen Benutzer
3. Logge dich ein
4. Prüfe, ob alles funktioniert

---

## 🎯 Vorteile von Railway

### Automatisch:
- ✅ DATABASE_URL wird gesetzt (keine manuelle Konfiguration!)
- ✅ Migrationen laufen beim Build
- ✅ GitHub Integration
- ✅ SSL-Zertifikat
- ✅ Custom Domain möglich

### Einfach:
- ✅ Alles in einem Dashboard
- ✅ Keine Connection Pooling URLs nötig
- ✅ Keine manuelle Firewall-Konfiguration
- ✅ Ein Klick für PostgreSQL

---

## 🔄 Von Vercel zu Railway migrieren

### Option 1: Beide parallel laufen lassen
- Railway für Produktion
- Vercel kann gelöscht werden (optional)

### Option 2: Vercel behalten
- Railway nur für Datenbank
- Vercel für Next.js (komplizierter)

**Empfehlung:** Alles auf Railway - viel einfacher!

---

## 💰 Kosten

- **Free Tier:** $5 Guthaben/Monat
- **Next.js App:** ~$0.50-1/Monat
- **PostgreSQL:** ~$0.50-1/Monat
- **Meist kostenlos** mit dem Free Tier!

---

## 🆘 Troubleshooting

### "Build failed"
- Prüfe Build-Logs in Railway
- Stelle sicher, dass `DATABASE_URL` gesetzt ist
- Prüfe, ob PostgreSQL Service läuft

### "Migration failed"
- Prüfe, ob `DATABASE_URL` korrekt ist
- Prüfe Build-Logs für Fehlermeldungen
- Stelle sicher, dass PostgreSQL Service aktiv ist

### "Can't connect to database"
- Prüfe, ob PostgreSQL Service läuft (grüner Status)
- Prüfe `DATABASE_URL` in Environment Variables
- Stelle sicher, dass beide Services im gleichen Projekt sind

---

## 📝 Nächste Schritte nach Deployment

1. **Custom Domain** (optional):
   - Railway → Settings → Domains
   - Füge deine Domain hinzu

2. **Monitoring**:
   - Railway zeigt automatisch Logs
   - Prüfe Metrics für Performance

3. **Backups**:
   - Railway erstellt automatisch Backups
   - Prüfe PostgreSQL → Backups

---

## 🎉 Fertig!

Nach ~5 Minuten sollte deine Anwendung live sein auf Railway!

**URL Format:** `https://iftar-organizasyon-production.up.railway.app`

Viel einfacher als Vercel + Supabase! 🚀
