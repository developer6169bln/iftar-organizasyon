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

## Start-Befehl (502 vermeiden)

- **Aktuell:** Railway startet mit `npx next start` (ohne Migrations-Skript), damit die App zuverlässig hochkommt.
- **Migration:** Die DB ist während des **Builds** nicht erreichbar (`postgres.railway.internal` nur zur Laufzeit). Daher **Migration nach dem Deploy einmalig ausführen** (lokal mit Railway CLI):
  ```bash
  railway link
  railway run npx prisma migrate deploy
  ```
  Danach ist die Tabelle `table_plans` (und alle anderen) vorhanden; Tischplanung und Grundriss-Upload funktionieren.

- **Nur Tabelle `table_plans` manuell anlegen:** Falls du nur die Tischplanung-Tabelle brauchst (ohne `prisma migrate deploy`):
  ```bash
  railway link
  railway run psql $DATABASE_URL -f manual_create_table_plans.sql
  ```
  Oder im Railway Dashboard: **Postgres** → **Data** / **Query** → SQL aus `manual_create_table_plans.sql` einfügen und ausführen.

## Sofort-Start (falls wieder 502)

- **Variable:** `SKIP_MIGRATION=true` (wenn du wieder `npm start` nutzt).
- Oder **Start Command** im Railway-Dashboard auf `npx next start` stellen.

## Grundriss (Tischplanung) dauerhaft speichern (Railway)

- Ohne Volume gehen hochgeladene Grundrisse bei jedem Redeploy verloren.
- **Lösung:** Railway **Volume** anlegen, an den Web-Service hängen, Mount-Pfad z.B. `/data/uploads`.
- Beim Web-Service **Variable** setzen: `UPLOAD_DIR=/data/uploads`.
- Dann werden Grundrisse im Volume gespeichert und bleiben nach Redeploy erhalten. Die App liefert sie über `/api/table-plan/floor-plan?eventId=...` aus.

## Änderungen im Code (bereits umgesetzt)

- **railway.json + nixpacks.toml:** Start = `npx next start` (kein Skript, kein DB-Warten).
- **Health:** `GET /api/health` gibt ohne `?db=1` sofort 200 zurück.
- **Grundriss:** Wird über `GET /api/table-plan/floor-plan?eventId=...` ausgeliefert (vom Server gelesen, funktioniert mit `UPLOAD_DIR` / Volume).
