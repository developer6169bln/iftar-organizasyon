# Railway: Attachments-Tabelle Migration

## Problem
Beim Klicken auf Bereiche auf Railway gibt es 500-Fehler, weil die `attachments` Tabelle noch nicht existiert.

## Lösung: Migration auf Railway ausführen

### Option 1: Über Railway Dashboard (Empfohlen)

1. **Öffne Railway Dashboard**
   - Gehe zu deinem Projekt
   - Klicke auf den **PostgreSQL Service**

2. **Öffne die Query-Konsole**
   - Klicke auf den Tab **"Data"** oder **"Query"**
   - Du siehst eine SQL-Konsole

3. **Führe diese SQL-Befehle aus:**

```sql
-- Erstelle die attachments Tabelle
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "checklistItemId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "checklist_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Erstelle Indizes
CREATE INDEX IF NOT EXISTS "attachments_taskId_idx" ON "attachments"("taskId");
CREATE INDEX IF NOT EXISTS "attachments_checklistItemId_idx" ON "attachments"("checklistItemId");
```

4. **Klicke auf "Run" oder "Execute"**

5. **Prüfe das Ergebnis**
   - Du solltest eine Erfolgsmeldung sehen
   - Die Tabelle sollte jetzt existieren

### Option 2: Über Railway CLI

1. **Installiere Railway CLI** (falls noch nicht installiert):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login zu Railway**:
   ```bash
   railway login
   ```

3. **Verbinde dich mit dem Projekt**:
   ```bash
   railway link
   ```

4. **Führe die Migration aus**:
   ```bash
   railway run npx prisma migrate deploy
   ```

### Option 3: Automatisch beim nächsten Build

Die Migration wird automatisch beim nächsten Build ausgeführt, da `package.json` bereits `prisma migrate deploy` im Build-Script enthält.

**Wichtig:** Nach der Migration muss der Web Service neu gestartet werden, damit Prisma Client die neue Tabelle erkennt.

## Verifikation

Nach der Migration kannst du prüfen, ob die Tabelle existiert:

```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'attachments';
```

Du solltest eine Zeile mit der `attachments` Tabelle sehen.

## Falls weiterhin Fehler auftreten

1. **Prüfe Railway Logs**:
   - Gehe zu deinem Web Service
   - Klicke auf "Logs"
   - Suche nach Fehlermeldungen

2. **Prüfe ob Prisma Client neu generiert wurde**:
   - Die Migration sollte automatisch `prisma generate` ausführen
   - Falls nicht, führe manuell aus: `npx prisma generate`

3. **Starte den Web Service neu**:
   - Im Railway Dashboard: Web Service → Settings → Restart
