# Mailgun E-Mail-Konfiguration – Checkliste

Alle Schritte für Mailgun sind im Projekt umgesetzt. Übersicht:

## 1. Datenbank (Prisma)
- **Schema** (`prisma/schema.prisma`): `EmailConfig` hat `mailgunDomain`, `mailgunApiKey`, `mailgunRegion`; `type` erlaubt `MAILGUN`.
- **Migration** (`prisma/migrations/20260128140000_add_mailgun_to_email_configs/migration.sql`): Spalten `mailgunDomain`, `mailgunApiKey`, `mailgunRegion` in `email_configs`.

## 2. API
- **GET** `/api/email-config`: Liefert `mailgunDomain` und `mailgunRegion`, **nicht** `mailgunApiKey` (Sicherheit).
- **POST** `/api/email-config`: Nimmt bei `type === 'MAILGUN'` Domain, API Key und Region entgegen und speichert sie.
- **PUT** `/api/email-config`: Aktualisiert Mailgun-Felder; API Key wird nur überschrieben, wenn ein neuer (nicht leerer) Wert gesendet wird (Bearbeiten ohne erneute Eingabe des Keys überschreibt ihn nicht).
- **Test** `/api/email-config/test`: Bei Mailgun Validierung (Domain + API Key), Versand der Test-Mail per HTTP API (US/EU).

## 3. E-Mail-Versand (`src/lib/email.ts`)
- `getEmailTransporter()`: Gibt bei `type === 'MAILGUN'` `null` zurück (kein SMTP).
- `sendViaMailgun()`: Versand per Mailgun HTTP API (Basic Auth, US/EU).
- `sendInvitationEmail()`: Bei aktiver Mailgun-Konfiguration wird `sendViaMailgun()` verwendet.

## 4. UI (Dashboard → Einladungen → E-Mail-Einstellungen)
- Typ **Mailgun (API)** im Dropdown.
- Felder: **Mailgun Domain** (Pflicht), **Mailgun Region** (US/EU), **Mailgun Private API Key** (Pflicht, Passwort-Feld).
- Speichern: Prüfung, dass bei Mailgun Domain und API Key ausgefüllt sind.
- Beim Bearbeiten: API Key wird nicht vom Server geliefert (leer im Formular); Speichern ohne erneute Eingabe lässt den gespeicherten Key unverändert.

## 5. Sicherheit
- API Key wird in GET- und PUT-Response nicht zurückgegeben.
- API Key nur in PUT aktualisiert, wenn ein nicht leerer Wert gesendet wird.

## Was du in Mailgun einrichten musst
1. Domain in Mailgun verifizieren (z. B. `mg.deinedomain.de`).
2. **Private API Key** unter Mailgun → Settings → API Keys erzeugen.
3. In der App: E-Mail-Konfiguration anlegen, Typ „Mailgun (API)“, Domain, Region (US oder EU) und API Key eintragen, speichern, Verbindung testen.
4. Absender-E-Mail muss zu der Domain passen (z. B. `noreply@mg.deinedomain.de` oder eine in Mailgun eingerichtete Adresse).

## Korrektur in diesem Check
- **PUT** `/api/email-config`: Mailgun API Key wird nur noch aktualisiert, wenn ein neuer, nicht leerer Wert gesendet wird. So wird der Key beim Bearbeiten anderer Felder nicht versehentlich gelöscht.
