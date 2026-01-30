# 502 Bad Gateway auf Railway beheben

## Schnell-Checkliste

1. **DATABASE_URL gesetzt?**
   - Railway Dashboard → dein **Web-Service** → **Variables**
   - Es muss eine Variable `DATABASE_URL` geben (z.B. von einer Postgres-Erweiterung verlinkt).
   - Ohne DATABASE_URL startet die App, stürzt aber beim ersten DB-Zugriff ab → 502.

2. **Postgres mit Service verlinken**
   - Wenn du eine **Postgres**-Erweiterung im Projekt hast: Postgres → **Variables** → `DATABASE_URL` kopieren.
   - Beim Web-Service → **Variables** → **Add Variable** → `DATABASE_URL` = (eingefügter Wert).

3. **Deploy-Logs prüfen**
   - Railway Dashboard → **Deployments** → letzten Deploy öffnen → **View Logs**.
   - Suche nach:
     - `❌ Fataler Start-Fehler` → Start-Skript ist abgestürzt.
     - `❌ Migration fehlgeschlagen` → DB nicht erreichbar oder Schema-Fehler.
     - `⚠️ DATABASE_URL fehlt` → Variable im Web-Service setzen.

4. **Health-Check (optional)**
   - `/api/health` antwortet sofort mit 200 (ohne DB).
   - Wenn Railway einen **Health Check Path** anbietet: auf `/api/health` setzen.
   - Mit DB-Prüfung: `/api/health?db=1`.

5. **Redeploy**
   - Nach Änderung der Variables: **Redeploy** auslösen (Deployments → ⋮ → Redeploy).

## Sofort-Start (wenn App trotzdem nicht hochkommt)

- **Variable setzen:** `SKIP_MIGRATION=true`
- Dann startet die App sofort ohne DB-Warte und ohne Migration. Danach im Railway-Dashboard oder per CLI Migration manuell ausführen: `railway run npx prisma migrate deploy`.

## Änderungen im Code (bereits umgesetzt)

- **Health:** `GET /api/health` gibt ohne `?db=1` sofort 200 zurück → Railway sieht „Service läuft“.
- **Start:** DB-Warte nur 15 s, Migration max. 3 Versuche – danach startet die App **immer** (kein `process.exit(1)` mehr).
- **Option:** `SKIP_MIGRATION=true` → sofort `next start`, keine DB/Migration.
