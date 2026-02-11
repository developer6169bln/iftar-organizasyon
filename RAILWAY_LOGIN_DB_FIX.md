# Login / DB „Can't reach database server at postgres.railway.internal“

Wenn der Login mit **„Can't reach database server at postgres.railway.internal“** fehlschlägt, kann die App die interne DB-URL von Railway nicht erreichen. Lösung: **öffentliche DB-URL** verwenden.

## Schnellfix (einmalig in Railway)

1. **Railway-Dashboard** → dein Projekt → **PostgreSQL-Service** (Datenbank) öffnen.
2. Tab **Variables** (oder **Connect**) öffnen.
3. Die Variable **`DATABASE_PUBLIC_URL`** (oder „Public connection string“) **kopieren**.
4. **App-Service** (nicht die DB) öffnen → **Variables**.
5. Neue Variable anlegen:
   - **Name:** `DATABASE_PUBLIC_URL`
   - **Wert:** den soeben kopierten Connection-String (beginnt z. B. mit `postgresql://postgres:...@...railway.app:...`)
6. **Deploy** des App-Services erneut auslösen (Redeploy).

Die App nutzt dann beim Start automatisch die öffentliche URL, wenn die interne URL (`postgres.railway.internal`) genutzt wird. Login und DB-Verbindung sollten wieder funktionieren.

## Hinweis

- `DATABASE_URL` (intern) bleibt unverändert; die App überschreibt sie intern mit `DATABASE_PUBLIC_URL`, sobald diese gesetzt ist.
- Die öffentliche URL ist von außen erreichbar; Zugriff wird über Railway abgesichert.
