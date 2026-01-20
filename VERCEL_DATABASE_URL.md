# Vercel DATABASE_URL - Connection Pooling

## ✅ Korrekte Connection Pooling URL für Vercel

Basierend auf deinem Supabase-Projekt (`civjhriuzgstodqgapxq`):

### Option 1: EU Central (am wahrscheinlichsten)
```
postgresql://postgres.civjhriuzgstodqgapxq:Yk&14612023!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### Option 2: EU West
```
postgresql://postgres.civjhriuzgstodqgapxq:Yk&14612023!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

### Option 3: US East
```
postgresql://postgres.civjhriuzgstodqgapxq:Yk&14612023!@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## 🔧 In Vercel setzen

1. **Vercel Dashboard** → Projekt `iftar-organizasyon` → **Settings** → **Environment Variables**
2. Finde `DATABASE_URL` → Klicke auf **✏️ Bearbeiten**
3. Ersetze die URL mit einer der URLs oben (beginne mit Option 1)
4. **Speichern**
5. **Redeploy** das Projekt

---

## 📋 Wie finde ich die korrekte Region?

1. Gehe zu **Supabase Dashboard** → Dein Projekt
2. **Settings** → **Database** → **Connection string**
3. Tab **"Connection pooling"** → **"Session mode"**
4. Die URL zeigt die korrekte Region

Die URL sollte so aussehen:
```
postgresql://postgres.civjhriuzgstodqgapxq:password@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Die **REGION** ist der Teil, den du brauchst (z.B. `eu-central-1`, `us-east-1`, etc.)

---

## ⚠️ Wichtig

- **Port 6543** (Connection Pooling) - nicht 5432!
- **pooler.supabase.com** - nicht db.xxxxx.supabase.co
- **postgres.xxxxx** - nicht nur postgres

---

## ✅ Nach dem Setzen

Nach dem Redeploy sollten die Build-Logs zeigen:
```
Datasource "db": PostgreSQL database ...
Applying migration `20260119231419_init`
...
All migrations have been successfully applied.
```
