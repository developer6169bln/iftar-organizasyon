# Railway: Persistente Uploads mit Volume und UPLOAD_DIR

Fotos und Videos aus dem Bereich **Foto & Video** bzw. **Media-Upload** werden standardmäßig im Dateisystem des Containers gespeichert. Auf Railway ist dieses **ephemeral** – bei jedem Redeploy oder Neustart sind die Dateien weg. Mit einem **Volume** und der Umgebungsvariable **UPLOAD_DIR** speicherst du Uploads dauerhaft.

---

## Kurzüberblick

1. **Volume** in Railway anlegen und an einen **Mount-Pfad** (z. B. `/data`) hängen.
2. **UPLOAD_DIR** auf diesen Pfad + Unterordner setzen (z. B. `/data/uploads`).
3. Beim Start erstellt das Start-Skript das Verzeichnis, falls nötig; die App schreibt und liest dort.

---

## Schritt 1: Volume im Railway-Projekt anlegen

1. Öffne dein **Railway-Projekt** (Dashboard).
2. Klicke auf deinen **Web-Service** (die Next.js-App), nicht auf die Datenbank.
3. Gehe zum Tab **"Settings"** (oder **"Variables"** – je nach Railway-Version kann die Oberfläche leicht abweichen).
4. Scrolle zu **"Volumes"** (oder suche nach **"Add Volume"** / **"Persistent Storage"**).
5. Klicke auf **"+ New Volume"** bzw. **"Add Volume"**.
6. **Mount Path** eintragen:
   - Trage als Mount Path **genau** ein: **`/data`**
   - (Ohne Anhängsel – der Unterordner `uploads` kommt über UPLOAD_DIR.)
7. Volume speichern/erstellen.

**Hinweis:** Pro Service ist nur **ein** Volume erlaubt. Mit Replicas kannst du keinen Volume nutzen (nur eine Instanz).

---

## Schritt 2: Umgebungsvariable UPLOAD_DIR setzen

1. Beim gleichen **Web-Service** zum Tab **"Variables"** wechseln.
2. **Neue Variable** hinzufügen:
   - **Name:** `UPLOAD_DIR`
   - **Value:** `/data/uploads`
3. Speichern (Add / Save).

Die App schreibt und liest alle Media-Uploads nun unter `/data/uploads`. Das Verzeichnis liegt auf dem Volume und bleibt über Deploys erhalten.

---

## Schritt 3: Redeploy auslösen

Nach dem Anlegen des Volumes und Setzen von **UPLOAD_DIR**:

1. **Redeploy** des Services auslösen (z. B. **"Deploy"** / **"Redeploy"** in der Railway-Oberfläche).
2. Beim Start führt das Start-Skript `mkdir` für `UPLOAD_DIR` aus (siehe `scripts/start-with-migrate.js`), falls das Verzeichnis noch nicht existiert.

Danach werden neue Fotos/Videos unter `/data/uploads` gespeichert und bleiben auch nach weiteren Deploys erhalten.

---

## Wichtige Hinweise

### Mount Path muss mit UPLOAD_DIR übereinstimmen

- Volume ist gemountet unter: **`/data`**
- App schreibt in: **`/data/uploads`** (weil `UPLOAD_DIR=/data/uploads`)

Wenn du einen anderen Mount Path wählst (z. B. `/storage`), setze z. B. **`UPLOAD_DIR=/storage/uploads`**.

### Keine Replicas bei Volumes

- Mit einem Volume darf der Service **nur mit einer Instanz** laufen.
- In den Railway **Settings** des Services: **Replicas** auf **1** stellen (oder Replicas deaktivieren).

### Speicherlimits (Railway)

- **Free/Trial:** 0,5 GB
- **Hobby:** 5 GB
- **Pro:** 50 GB (erweiterbar)

### Berechtigungen

Falls die App beim Schreiben in das Volume Fehler meldet (Permission denied), kann **optional** gesetzt werden:

- **Name:** `RAILWAY_RUN_UID`
- **Value:** `0`

(Dann läuft der Container als root; nur setzen, wenn es ohne nicht funktioniert.)

---

## Prüfen, ob es funktioniert

1. Nach Redeploy in der App ein **Foto oder Video** hochladen (Foto & Video oder Media-Upload).
2. Prüfen, ob das Bild/Video angezeigt wird.
3. Einen **weiteren Redeploy** auslösen.
4. Seite neu laden – die zuvor hochgeladenen Medien sollten weiterhin sichtbar sein (weil sie auf dem Volume unter `/data/uploads` liegen).

---

## Ohne Volume (Standard)

Wenn **kein** Volume und **kein** UPLOAD_DIR gesetzt sind:

- Uploads landen unter `public/uploads` im Container.
- Sie werden über die API unter `/api/uploads/[filename]` ausgeliefert.
- Nach einem Redeploy sind die Dateien **weg**; nur die Einträge in der Datenbank bleiben (Anzeige dann 404, bis wieder neu hochgeladen wird).

Für dauerhafte Uploads auf Railway also **Volume + UPLOAD_DIR** wie oben einrichten.
