# Deployment-Anleitung für Iftar Organizasyon

## 🚀 Kostenlose Hosting-Optionen

### 1. **Vercel** (Empfohlen für Next.js) ⭐
- **Kostenlos**: Ja (Hobby Plan)
- **Next.js Support**: Perfekt (von Next.js-Entwicklern gemacht)
- **Datenbank**: SQLite funktioniert, aber für Produktion besser PostgreSQL
- **URL**: https://vercel.com

**Vorteile:**
- Automatisches Deployment von GitHub
- SSL-Zertifikat inklusive
- Sehr schnelle Performance
- Einfache Einrichtung

**Nachteile:**
- SQLite-Dateien werden bei jedem Deployment zurückgesetzt (Serverless)
- Für persistente Datenbank besser PostgreSQL verwenden

**Schritte:**
1. Code auf GitHub hochladen
2. Auf vercel.com registrieren
3. Projekt importieren
4. Environment Variables setzen (JWT_SECRET)
5. Deploy!

---

### 2. **Railway** 🚂
- **Kostenlos**: $5 Guthaben/Monat (meist ausreichend)
- **Next.js Support**: Sehr gut
- **Datenbank**: PostgreSQL kostenlos verfügbar
- **URL**: https://railway.app

**Vorteile:**
- PostgreSQL-Datenbank inklusive
- Persistente Daten
- Einfache Einrichtung
- Docker-Support

**Schritte:**
1. Auf railway.app registrieren
2. "New Project" → "Deploy from GitHub repo"
3. PostgreSQL-Datenbank hinzufügen
4. Environment Variables setzen
5. Deploy!

---

### 3. **Render** 🎨
- **Kostenlos**: Ja (mit Einschränkungen)
- **Next.js Support**: Gut
- **Datenbank**: PostgreSQL kostenlos verfügbar
- **URL**: https://render.com

**Vorteile:**
- PostgreSQL-Datenbank kostenlos
- Automatische Deployments
- SSL inklusive

**Nachteile:**
- App schläft nach 15 Minuten Inaktivität (kostenloser Plan)
- Langsamere Startzeit nach dem Schlafmodus

**Schritte:**
1. Auf render.com registrieren
2. "New Web Service" → GitHub Repo verbinden
3. PostgreSQL-Datenbank erstellen
4. Environment Variables setzen
5. Deploy!

---

### 4. **Fly.io** ✈️
- **Kostenlos**: Ja (3 VMs kostenlos)
- **Next.js Support**: Gut
- **Datenbank**: PostgreSQL verfügbar
- **URL**: https://fly.io

**Vorteile:**
- Globale Verteilung
- PostgreSQL-Datenbank
- Docker-basiert

---

## 📋 Vorbereitung für Deployment

### Wichtig: Datenbank-Migration von SQLite zu PostgreSQL

Da SQLite auf Serverless-Plattformen nicht persistent ist, sollte PostgreSQL verwendet werden:

1. **Prisma Schema anpassen:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **PostgreSQL-Datenbank erstellen** (auf Railway/Render/Fly.io)

3. **Migration ausführen:**
   ```bash
   npx prisma migrate deploy
   ```

---

## 🔧 Environment Variables

Diese Variablen müssen auf dem Server gesetzt werden:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=dein-sehr-langer-geheimer-schluessel
NODE_ENV=production
```

---

## 📝 Deployment-Checkliste

- [ ] Code auf GitHub hochladen
- [ ] `.env` Datei NICHT committen (ist bereits in .gitignore)
- [ ] PostgreSQL-Datenbank erstellen
- [ ] Prisma Schema auf PostgreSQL umstellen
- [ ] Migration ausführen
- [ ] Environment Variables auf Server setzen
- [ ] Build testen: `npm run build`
- [ ] Deploy!

---

## 🎯 Empfehlung

**Für den Start: Railway oder Render**
- Beide bieten kostenlose PostgreSQL-Datenbanken
- Einfache Einrichtung
- Persistente Daten

**Für beste Performance: Vercel**
- Aber dann PostgreSQL über externe Anbieter (z.B. Supabase kostenlos)
