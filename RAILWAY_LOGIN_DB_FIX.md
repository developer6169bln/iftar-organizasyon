# Login / DB „Can't reach database server at postgres.railway.internal“

Wenn der Login mit **„Can't reach database server at postgres.railway.internal“** fehlschlägt, erreicht die App die interne DB-URL von Railway nicht. Lösung: **öffentliche DB-URL** als `DATABASE_PUBLIC_URL` im **App-Service** setzen.

## Fix in Railway (einmalig)

### 1. Öffentliche URL aus dem Postgres-Service holen

1. **Railway-Dashboard** → dein Projekt → **PostgreSQL-Service** (die Datenbank) anklicken.
2. Tab **Variables** oder **Connect** öffnen.
3. Dort die **öffentliche** Verbindungs-URL finden:
   - Entweder heißt die Variable **`DATABASE_PUBLIC_URL`** – den **Wert** komplett kopieren (beginnt mit `postgresql://postgres:...@...`).
   - Oder unter **Connect** / **Public Network** den angezeigten Connection-String kopieren.

### 2. Beim App-Service eintragen

1. Im selben Projekt den **App-Service** (deine Next.js-App) anklicken – **nicht** den Postgres-Service.
2. Tab **Variables** öffnen.
3. **Neue Variable** anlegen:
   - **Name:** `DATABASE_PUBLIC_URL` (genau so)
   - **Wert:** die in Schritt 1 kopierte URL einfügen.
4. Speichern.

**Alternative (Referenz):** Wenn Railway es anbietet, kannst du statt eines festen Werts eine **Referenz** auf den Postgres-Service setzen (z. B. Variable aus Postgres-Service auswählen). Dann muss der Name im App-Service `DATABASE_PUBLIC_URL` sein.

### 3. App neu starten

- Beim App-Service **Redeploy** auslösen (z. B. **Deploy** → **Redeploy** oder neuen Commit deployen).

Danach nutzt die App beim Start die öffentliche URL und der Login sollte wieder funktionieren.

## Was passiert technisch

- Die App prüft beim Start: Enthält `DATABASE_URL` `railway.internal` und ist `DATABASE_PUBLIC_URL` gesetzt, wird intern `DATABASE_URL` durch `DATABASE_PUBLIC_URL` ersetzt.
- Migration und Laufzeit nutzen dann die öffentliche DB-URL; die Meldung „Can't reach database server at postgres.railway.internal“ verschwindet.
