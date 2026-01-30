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

## Änderungen im Code (bereits umgesetzt)

- **Health:** `GET /api/health` gibt ohne `?db=1` sofort 200 zurück → Railway sieht „Service läuft“.
- **Start:** DB-Wartezeit auf 60 s reduziert, `NODE_ENV=production` gesetzt.
