# Iftar Organizasyon - Event Management System

Web-Anwendung zur Koordination und Verwaltung einer Iftar-Veranstaltung am 27.02.2026 im Titanic Hotel.

## 🎯 Features

- **Benutzerverwaltung**: Registrierung und Login
- **9 Organisationsbereiche**:
  1. Protokol
  2. Davet Listesi (Gästeliste)
  3. Misafir Karşılama (Gästeempfang)
  4. Güvenlik (Sicherheit)
  5. Otel Koordinasyon (Hotel-Koordination)
  6. Sahur Koordinasyon
  7. Müzik Ekibi (Musik-Team)
  8. Konuşmacı (Sprecher)
  9. Genel Merkez Koordinasyon (Hauptquartier-Koordination)
  10. Program Akışı (Programmablauf)

- **Gästeverwaltung**: 
  - VIP-Markierung
  - Besonderer Empfang
  - Anreisedatum & Uhrzeit
  - Inline-Bearbeitung
  - Suche

- **Aufgabenverwaltung**: Tasks mit Status, Priorität, Fälligkeitsdatum
- **Checklisten**: Für jeden Bereich
- **Programmplanung**: Zeitplanung mit Konuşmacı, Müzik, Ezan, Kuran, Hitabet, Iftar Start, Sunucu

## 🛠️ Technologie-Stack

- **Next.js 16** - React Framework
- **TypeScript** - Type Safety
- **Prisma 6** - ORM für Datenbank
- **SQLite** (Development) / **PostgreSQL** (Production)
- **Tailwind CSS** - Styling
- **Zod** - Schema Validation
- **JWT** (jose) - Authentication

## 📦 Installation

```bash
# Dependencies installieren
npm install

# Datenbank migrieren
npx prisma migrate dev

# Development Server starten
npm run dev
```

Die Anwendung läuft dann auf http://localhost:3000

## 🔧 Environment Variables

Erstelle eine `.env` Datei:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dein-sehr-langer-geheimer-schluessel"
```

## 📝 Datenbank

### Development (SQLite)
```bash
npx prisma migrate dev
```

### Production (PostgreSQL)
Siehe `DEPLOYMENT.md` für Anleitung zur Migration auf PostgreSQL.

## 🚀 Deployment

Siehe `DEPLOYMENT.md` für detaillierte Anleitung zu:
- Railway
- Render
- Vercel
- Fly.io

## 📄 Lizenz

Privat
