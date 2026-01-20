# 🗄️ SQL-Tabellen auf Railway erstellen

## SQL-Script ausführen

### Option 1: Railway Dashboard (Einfachste Methode)

1. **Railway Dashboard** → Dein Projekt
2. **PostgreSQL Service** → Tab **"Data"** oder **"Query"**
3. Kopiere den Inhalt von `create_tables.sql`
4. Füge ihn in den SQL-Editor ein
5. Klicke auf **"Run"** oder **"Execute"**

---

### Option 2: Railway CLI

```bash
# 1. Railway CLI installieren (falls noch nicht)
npm i -g @railway/cli

# 2. Login
railway login

# 3. Projekt verbinden
railway link

# 4. SQL-Script ausführen
railway run psql $DATABASE_URL < create_tables.sql
```

Oder direkt:
```bash
railway run psql $DATABASE_URL -f create_tables.sql
```

---

### Option 3: Mit psql direkt

Falls du `psql` lokal installiert hast:

1. **DATABASE_URL kopieren** (von Railway PostgreSQL Service)
2. Führe aus:
   ```bash
   psql "postgresql://user:password@host:port/database" -f create_tables.sql
   ```

---

## Prüfen ob Tabellen erstellt wurden

### In Railway:

1. **PostgreSQL Service** → Tab **"Data"** oder **"Query"**
2. Führe aus:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
3. Du solltest sehen:
   - users
   - events
   - guests
   - tasks
   - task_assignments
   - checklist_items
   - protocols
   - notes
   - program_items

### Über Health-Check:

```
GET https://iftar-organizasyon-production.up.railway.app/api/health
```

Sollte jetzt zeigen:
```json
{
  "status": "ok",
  "database": "connected",
  "tables": {
    "users": "exists (0 users)"
  }
}
```

---

## Nach dem Erstellen der Tabellen

1. **Health-Check prüfen:** `/api/health`
2. **Registrierung testen:** Sollte jetzt funktionieren!
3. **Anwendung testen:** Alle Features sollten funktionieren

---

## ⚠️ Wichtig

- Führe das Script **nur einmal** aus
- Falls Tabellen bereits existieren, werden sie **nicht überschrieben** (IF NOT EXISTS)
- Alle Foreign Keys werden automatisch erstellt
- Trigger für `updatedAt` werden automatisch erstellt

---

## 🆘 Falls Fehler auftreten

### "relation already exists"
- Tabellen existieren bereits
- Das ist OK - Script ist idempotent (kann mehrfach ausgeführt werden)

### "permission denied"
- Prüfe, ob du die richtige Datenbank verwendest
- Prüfe, ob der User die richtigen Rechte hat

### "syntax error"
- Prüfe, ob du PostgreSQL (nicht MySQL) verwendest
- Prüfe, ob alle Anführungszeichen korrekt sind

---

## ✅ Erfolg!

Nach dem Ausführen des SQL-Scripts:
- ✅ Alle Tabellen erstellt
- ✅ Foreign Keys gesetzt
- ✅ Indexes erstellt
- ✅ Trigger für updatedAt aktiv
- ✅ Registrierung funktioniert
- ✅ Anwendung vollständig funktionsfähig!
