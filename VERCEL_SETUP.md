# Vercel Setup-Anleitung

## 🚀 Projekt auf Vercel deployen

### Schritt 1: Projekt importieren

1. Gehe zu https://vercel.com und logge dich ein (oder erstelle einen Account)
2. Klicke auf **"Add New..."** → **"Project"**
3. Wähle **"Import Git Repository"**
4. Verbinde dein GitHub-Account (falls noch nicht verbunden)
5. Wähle das Repository: `developer6169bln/iftar-organizasyon`
6. Klicke auf **"Import"**

---

### Schritt 2: Environment Variables setzen

**WICHTIG:** Setze die Environment Variables **VOR** dem ersten Deploy!

#### In der Vercel-UI:

1. Nach dem Import siehst du die **"Configure Project"** Seite
2. Scrolle nach unten zu **"Environment Variables"**
3. Klicke auf **"Add"** oder das **"+"** Symbol

#### JWT_SECRET hinzufügen:

1. **Name**: `JWT_SECRET`
2. **Value**: Ein langer, zufälliger String (mindestens 32 Zeichen)
   - Beispiel: `my-super-secret-jwt-key-2026-iftar-organizasyon-very-long-string`
   - Oder generiere einen: https://randomkeygen.com/
3. **Environment**: Wähle alle aus:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Klicke auf **"Save"**

#### DATABASE_URL hinzufügen (wenn PostgreSQL verwendet wird):

1. **Name**: `DATABASE_URL`
2. **Value**: Deine PostgreSQL Connection String
   - Format: `postgresql://user:password@host:5432/dbname`
   - Beispiel: `postgresql://postgres:password@db.example.com:5432/iftar_db`
3. **Environment**: Wähle alle aus
4. Klicke auf **"Save"**

#### NODE_ENV (optional):

1. **Name**: `NODE_ENV`
2. **Value**: `production`
3. **Environment**: Production
4. Klicke auf **"Save"**

---

### Schritt 3: Build Settings prüfen

Vercel sollte automatisch erkennen:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (oder automatisch)
- **Output Directory**: `.next` (automatisch)
- **Install Command**: `npm install` (automatisch)

Falls nicht, stelle sicher:
- **Framework Preset**: Next.js
- **Root Directory**: `./` (oder leer lassen)

---

### Schritt 4: Deploy

1. Klicke auf **"Deploy"**
2. Warte, bis der Build fertig ist (ca. 2-5 Minuten)
3. Nach erfolgreichem Deploy erhältst du eine URL: `https://iftar-organizasyon.vercel.app`

---

## 🔧 Environment Variables nachträglich ändern

Falls du die Environment Variables später ändern möchtest:

1. Gehe zu deinem Projekt auf Vercel
2. Klicke auf **"Settings"** (oben im Menü)
3. Klicke auf **"Environment Variables"** (linke Sidebar)
4. Hier kannst du:
   - Neue Variables hinzufügen
   - Bestehende bearbeiten (✏️)
   - Löschen (🗑️)

**WICHTIG:** Nach dem Ändern von Environment Variables:
- Klicke auf **"Redeploy"** für alle Deployments
- Oder warte auf den nächsten automatischen Deploy

---

## 📋 Checkliste für Vercel Deployment

- [ ] Vercel Account erstellt
- [ ] GitHub Repository verbunden
- [ ] Projekt importiert
- [ ] `JWT_SECRET` Environment Variable gesetzt
- [ ] `DATABASE_URL` gesetzt (falls PostgreSQL verwendet wird)
- [ ] `NODE_ENV` gesetzt (optional)
- [ ] Build Settings geprüft
- [ ] Erster Deploy erfolgreich
- [ ] URL funktioniert

---

## ⚠️ Wichtige Hinweise

### SQLite funktioniert NICHT auf Vercel

Vercel ist eine Serverless-Plattform. SQLite-Dateien werden bei jedem Deployment zurückgesetzt.

**Lösung:** Verwende PostgreSQL:
- **Kostenlos**: Supabase (https://supabase.com) - kostenlose PostgreSQL-Datenbank
- **Oder**: Railway, Render, Fly.io (siehe DEPLOYMENT.md)

### Prisma Schema für PostgreSQL anpassen

1. Kopiere `prisma/schema.postgresql.prisma` nach `prisma/schema.prisma`
2. Oder ändere in `schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Führe Migration aus:
   ```bash
   npx prisma migrate deploy
   ```

---

## 🔐 JWT_SECRET generieren

Falls du einen sicheren JWT_SECRET generieren möchtest:

### Option 1: Online Generator
- https://randomkeygen.com/
- Wähle "CodeIgniter Encryption Keys" (64 Zeichen)

### Option 2: Terminal
```bash
# macOS/Linux
openssl rand -base64 32

# Oder
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Option 3: Node.js Script
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Empfohlene Länge:** Mindestens 32 Zeichen, besser 64+ Zeichen

---

## 📝 Beispiel Environment Variables

```
JWT_SECRET=my-super-secret-jwt-key-2026-iftar-organizasyon-very-long-random-string-123456789
DATABASE_URL=postgresql://user:password@host:5432/dbname
NODE_ENV=production
```

---

## 🆘 Troubleshooting

### "Environment Variable not found"
- Prüfe, ob die Variable in allen Environments (Production, Preview, Development) gesetzt ist
- Redeploy das Projekt nach dem Hinzufügen

### "Database connection failed"
- Prüfe die `DATABASE_URL`
- Stelle sicher, dass PostgreSQL verwendet wird (nicht SQLite)
- Prüfe, ob die Datenbank von außen erreichbar ist

### "Build failed"
- Prüfe die Build-Logs in Vercel
- Stelle sicher, dass alle Dependencies in `package.json` sind
- Prüfe, ob `prisma generate` im Build-Prozess läuft

---

## 🔗 Nützliche Links

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs: https://vercel.com/docs
- Supabase (kostenlose PostgreSQL): https://supabase.com
