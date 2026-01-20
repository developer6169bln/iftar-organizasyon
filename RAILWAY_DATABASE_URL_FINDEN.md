# 🔍 DATABASE_URL in Railway finden

## Option 1: In PostgreSQL Service Variables

### Schritt-für-Schritt:

1. **Railway Dashboard öffnen**: https://railway.app/dashboard
2. **Wähle dein Projekt** (z.B. "iftar-organizasyon")
3. **Klicke auf deinen PostgreSQL Service** (grünes Icon mit Datenbank-Symbol)
4. **Gehe zum Tab "Variables"** (oben im Menü)
5. **Suche nach `DATABASE_URL`** oder `POSTGRES_URL` oder `PGDATABASE`

**Falls vorhanden:**
- Kopiere die komplette URL
- Gehe zu Web Service → Variables → "+ New Variable"
- Name: `DATABASE_URL`
- Value: Die kopierte URL
- Speichern

---

## Option 2: In PostgreSQL Service → Connect Tab

1. **PostgreSQL Service** → Tab **"Connect"** oder **"Data"**
2. **Connection String** oder **"Postgres Connection URL"**
3. Kopiere die URL

---

## Option 3: Aus Connection Details konstruieren

Falls die URL nicht direkt sichtbar ist:

1. **PostgreSQL Service** → Tab **"Variables"**
2. Suche nach:
   - `POSTGRES_HOST`
   - `POSTGRES_PORT`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`

3. **Konstruiere die URL:**
   ```
   postgresql://POSTGRES_USER:POSTGRES_PASSWORD@POSTGRES_HOST:POSTGRES_PORT/POSTGRES_DB
   ```

**Beispiel:**
```
postgresql://postgres:abc123@containers-us-west-123.railway.app:5432/railway
```

---

## Option 4: Railway CLI verwenden

### Schritt 1: Railway CLI installieren
```bash
npm i -g @railway/cli
```

### Schritt 2: Login
```bash
railway login
```

### Schritt 3: Projekt verbinden
```bash
railway link
```
- Wähle dein Projekt aus der Liste

### Schritt 4: Variables anzeigen
```bash
railway variables
```

Das zeigt alle Environment Variables, inklusive DATABASE_URL!

### Schritt 5: DATABASE_URL direkt anzeigen
```bash
railway variables --service postgres
```

Oder für alle Services:
```bash
railway variables --json | grep DATABASE_URL
```

---

## Option 5: In Railway Dashboard → Project Settings

1. **Railway Dashboard** → Dein Projekt
2. Klicke auf **"Settings"** (oben rechts)
3. Tab **"Variables"**
4. Hier sollten alle Project-level Variables sein
5. Prüfe, ob `DATABASE_URL` hier ist

---

## Option 6: Neue PostgreSQL-Datenbank erstellen (falls keine vorhanden)

Falls du keine PostgreSQL-Datenbank hast:

1. **Railway Dashboard** → Dein Projekt
2. Klicke auf **"+ New"**
3. Wähle **"Database"** → **"Add PostgreSQL"**
4. Railway erstellt automatisch eine Datenbank
5. **WICHTIG:** Railway setzt automatisch `DATABASE_URL` in den Variables!

---

## ⚠️ Wichtig: DATABASE_URL muss im Web Service sein!

Die DATABASE_URL muss im **Web Service** (nicht nur im PostgreSQL Service) sein:

1. **Web Service** → **Variables**
2. Prüfe, ob `DATABASE_URL` vorhanden ist
3. Falls **NICHT**:
   - Kopiere von PostgreSQL Service
   - Füge zu Web Service hinzu

---

## 🔄 Services verbinden (automatisch DATABASE_URL setzen)

Railway kann `DATABASE_URL` automatisch setzen, wenn Services verbunden sind:

1. **Web Service** → **Settings**
2. Scrolle zu **"Service Dependencies"**
3. Klicke **"+ Add Service"**
4. Wähle deinen **PostgreSQL Service**
5. Railway verbindet die Services
6. **DATABASE_URL wird automatisch gesetzt!** 🎉

---

## 📋 Checkliste

- [ ] PostgreSQL Service vorhanden?
- [ ] PostgreSQL Service → Variables → DATABASE_URL gefunden?
- [ ] Falls nicht → Connect Tab prüfen
- [ ] Falls nicht → Railway CLI verwenden
- [ ] DATABASE_URL zu Web Service hinzugefügt?
- [ ] Services verbunden (Service Dependencies)?
- [ ] Redeploy ausgeführt?

---

## 🆘 Falls nichts funktioniert

### Erstelle neue PostgreSQL-Datenbank:

1. **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway erstellt neue Datenbank
3. **DATABASE_URL wird automatisch gesetzt**
4. Migrationen ausführen:
   ```bash
   railway run npx prisma migrate deploy
   ```

---

## 💡 Tipp

**Einfachste Methode:**
1. Services verbinden (Service Dependencies)
2. Railway setzt DATABASE_URL automatisch
3. Fertig! 🎉
