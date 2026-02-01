# Seed: Admin und Editionen (V2)

Nach der Migration **Editionen & Berechtigungen** einmalig ausführen, um:

- **Editionen** Free, Silver, Gold anzulegen (Free mit allen Seiten/Kategorien)
- **Admin-User** anzulegen: `yasko1461@gmail.com` mit Rolle ADMIN

## Aufruf

```bash
# Mit Standard-Passwort (14612023)
npm run seed

# Oder mit eigenem Passwort
SEED_ADMIN_PASSWORD=dein-passwort node scripts/seed-admin-editions.js
```

**Hinweis:** Das Passwort wird nur beim Seed gesetzt (bzw. bei bestehendem Admin aktualisiert). Danach bitte ggf. in der App ändern.

## Railway

Nach `railway run npx prisma migrate deploy`:

```bash
railway run npm run seed
```

Oder mit Umgebungsvariable:

```bash
railway run env SEED_ADMIN_PASSWORD=14612023 node scripts/seed-admin-editions.js
```

## Login

- **E-Mail:** yasko1461@gmail.com  
- **Passwort:** 14612023 (oder das, was Sie bei `SEED_ADMIN_PASSWORD` gesetzt haben)

Der Admin sieht alle Seiten und Arbeitsbereiche und hat Zugriff auf **Admin & Statistik** (Top-User-Statistik, künftig Benutzer- und Editionsverwaltung).
