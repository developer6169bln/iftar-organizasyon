# Supabase PostgreSQL Setup für Vercel

## 🚀 Schritt-für-Schritt Anleitung

### Schritt 1: Supabase Projekt erstellen

1. Gehe zu https://supabase.com
2. Klicke auf **"Start your project"** oder **"Sign in"**
3. Erstelle einen Account (kostenlos mit GitHub/Email)
4. Klicke auf **"New Project"**
5. Fülle aus:
   - **Name**: `iftar-organizasyon` (oder ein anderer Name)
   - **Database Password**: Wähle ein sicheres Passwort (⚠️ **WICHTIG: Speichere es!**)
   - **Region**: Wähle die nächstgelegene Region (z.B. "West EU (Ireland)")
   - **Pricing Plan**: Free (kostenlos)
6. Klicke auf **"Create new project"**
7. Warte 1-2 Minuten, bis das Projekt erstellt ist

---

### Schritt 2: PostgreSQL Connection String kopieren

1. In deinem Supabase Projekt, gehe zu **"Settings"** (⚙️ im linken Menü)
2. Klicke auf **"Database"**
3. Scrolle nach unten zu **"Connection string"**
4. Wähle **"URI"** Tab
5. Kopiere die Connection String (sieht so aus):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. **Ersetze `[YOUR-PASSWORD]`** mit dem Passwort, das du bei der Projekt-Erstellung gewählt hast
7. Beispiel:
   ```
   postgresql://postgres:mein-sicheres-passwort-123@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

---

### Schritt 3: Prisma Schema auf PostgreSQL umstellen

**Lokal auf deinem Computer:**

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon

# Backup des aktuellen Schemas (falls nötig)
cp prisma/schema.prisma prisma/schema.sqlite.backup

# PostgreSQL Schema aktivieren
cp prisma/schema.postgresql.prisma prisma/schema.prisma
```

**Oder manuell ändern:**

Öffne `prisma/schema.prisma` und ändere:

```prisma
datasource db {
  provider = "postgresql"  // von "sqlite" ändern
  url      = env("DATABASE_URL")  // von "file:./dev.db" ändern
}
```

---

### Schritt 4: Environment Variable in Vercel setzen

1. Gehe zu deinem Vercel Dashboard: https://vercel.com/dashboard
2. Wähle dein Projekt: `iftar-organizasyon`
3. Klicke auf **"Settings"** (oben im Menü)
4. Klicke auf **"Environment Variables"** (linke Sidebar)
5. Klicke auf **"Add"** oder das **"+"** Symbol
6. Fülle aus:
   - **Name**: `DATABASE_URL`
   - **Value**: Die Connection String von Supabase (mit Passwort ersetzt)
   - **Environment**: Wähle alle aus:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
7. Klicke auf **"Save"**

**Wichtig:** Die Connection String sollte so aussehen:
```
postgresql://postgres:DEIN-PASSWORT@db.xxxxx.supabase.co:5432/postgres
```

---

### Schritt 5: Migration auf PostgreSQL ausführen

**Option A: Über Vercel (automatisch beim nächsten Deploy)**

1. Nach dem Setzen der `DATABASE_URL` in Vercel
2. Gehe zu **"Deployments"**
3. Klicke auf **"Redeploy"** → **"Use existing Build Cache"** (oder **"Redeploy"**)
4. Vercel wird automatisch `prisma migrate deploy` ausführen

**Option B: Lokal testen (empfohlen)**

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon

# Environment Variable lokal setzen (für Test)
export DATABASE_URL="postgresql://postgres:DEIN-PASSWORT@db.xxxxx.supabase.co:5432/postgres"

# Prisma Client neu generieren
npx prisma generate

# Migration ausführen
npx prisma migrate deploy

# Oder neue Migration erstellen (falls Schema geändert wurde)
npx prisma migrate dev --name init_postgresql
```

---

### Schritt 6: Code auf GitHub pushen

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon

# Änderungen committen
git add prisma/schema.prisma
git commit -m "Switch to PostgreSQL for production"

# Auf GitHub pushen
git push
```

---

### Schritt 7: Vercel neu deployen

1. Vercel sollte automatisch neu deployen (wenn GitHub-Integration aktiv ist)
2. Oder manuell: Vercel Dashboard → Projekt → **"Redeploy"**
3. Prüfe die Build-Logs - sollte jetzt PostgreSQL verwenden

---

## ✅ Checkliste

- [ ] Supabase Projekt erstellt
- [ ] Database Password gespeichert
- [ ] Connection String kopiert
- [ ] `DATABASE_URL` in Vercel gesetzt (mit Passwort ersetzt)
- [ ] Prisma Schema auf PostgreSQL umgestellt
- [ ] Migration ausgeführt (`prisma migrate deploy`)
- [ ] Code auf GitHub gepusht
- [ ] Vercel neu deployed
- [ ] Build erfolgreich
- [ ] Anwendung funktioniert

---

## 🔍 Prüfen ob es funktioniert

### In Supabase:

1. Gehe zu **"Table Editor"** in Supabase
2. Du solltest alle Tabellen sehen:
   - `users`
   - `events`
   - `guests`
   - `tasks`
   - `checklist_items`
   - `program_items`
   - etc.

### In Vercel:

1. Prüfe die Build-Logs
2. Sollte zeigen: `Datasource "db": PostgreSQL database`
3. Keine SQLite-Fehler mehr

---

## 🆘 Troubleshooting

### "Connection refused" oder "Database connection failed"

- Prüfe, ob das Passwort in der Connection String korrekt ist
- Prüfe, ob `DATABASE_URL` in Vercel gesetzt ist
- Prüfe, ob Supabase Projekt aktiv ist (nicht pausiert)

### "Migration failed"

- Stelle sicher, dass das Schema auf PostgreSQL umgestellt ist
- Führe `npx prisma migrate reset` lokal aus (⚠️ löscht alle Daten!)
- Dann `npx prisma migrate deploy` erneut

### "Table already exists"

- Die Migration wurde bereits ausgeführt
- Das ist OK - die Tabellen existieren bereits

---

## 📝 Wichtige Hinweise

1. **Passwort sicher aufbewahren**: Du brauchst es für die Connection String
2. **Supabase Free Plan**: 
   - 500 MB Datenbank-Speicher
   - 2 GB Bandbreite/Monat
   - Für kleine/mittlere Projekte ausreichend
3. **Backup**: Supabase erstellt automatisch Backups (kostenloser Plan: 1 Tag Retention)

---

## 🔗 Nützliche Links

- Supabase Dashboard: https://supabase.com/dashboard
- Supabase Docs: https://supabase.com/docs
- Prisma PostgreSQL Guide: https://www.prisma.io/docs/concepts/database-connectors/postgresql
