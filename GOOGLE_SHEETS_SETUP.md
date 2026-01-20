# Google Sheets Synchronisation Setup

## Übersicht

Die Gästeliste kann automatisch mit Google Sheets synchronisiert werden. Dies ermöglicht:
- ✅ Bidirektionale Synchronisation (Datenbank ↔ Google Sheets)
- ✅ Automatische Synchronisation bei Änderungen
- ✅ Manuelle Synchronisation per Button
- ✅ Import von Gästen aus Google Sheets

## Setup-Anleitung

### Option 1: Service Account (Empfohlen für Produktion)

1. **Google Cloud Console Setup**
   - Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
   - Erstelle ein neues Projekt oder wähle ein bestehendes
   - Aktiviere die "Google Sheets API"

2. **Service Account erstellen**
   - Gehe zu "IAM & Admin" → "Service Accounts"
   - Klicke auf "Create Service Account"
   - Gib einen Namen ein (z.B. "iftar-sheets-sync")
   - Klicke auf "Create and Continue"
   - Überspringe Rollen (optional)
   - Klicke auf "Done"

3. **Service Account Key erstellen**
   - Klicke auf den erstellten Service Account
   - Gehe zum Tab "Keys"
   - Klicke auf "Add Key" → "Create new key"
   - Wähle "JSON" Format
   - Die JSON-Datei wird heruntergeladen

4. **Google Sheet vorbereiten**
   - Erstelle ein neues Google Sheet oder öffne ein bestehendes
   - Klicke auf "Teilen" (Share)
   - Füge die E-Mail-Adresse des Service Accounts hinzu (findest du in der JSON-Datei unter `client_email`)
   - Gib "Editor" Berechtigung
   - Kopiere die Spreadsheet ID aus der URL:
     ```
     https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HIER/edit
     ```

5. **Umgebungsvariable setzen**
   - Öffne die heruntergeladene JSON-Datei
   - Kopiere den gesamten Inhalt
   - Füge in `.env` (oder Railway/Vercel Environment Variables) hinzu:
     ```
     GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
     ```
   - **Wichtig**: Der gesamte JSON-String muss in Anführungszeichen stehen

### Option 2: API Key (Nur für öffentliche Sheets, nur lesen)

1. **API Key erstellen**
   - Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
   - Erstelle ein neues Projekt
   - Aktiviere die "Google Sheets API"
   - Gehe zu "APIs & Services" → "Credentials"
   - Klicke auf "Create Credentials" → "API Key"
   - Kopiere den API Key

2. **Google Sheet öffentlich machen**
   - Öffne das Google Sheet
   - Klicke auf "Teilen" → "Jeder mit dem Link"
   - Wähle "Jeder mit dem Link kann anzeigen"

3. **Umgebungsvariable setzen**
   ```
   GOOGLE_API_KEY=dein_api_key_hier
   ```

## Verwendung in der Anwendung

1. **Konfiguration**
   - Gehe zur Gästeliste-Seite (`/dashboard/guests`)
   - Klicke auf "📊 Google Sheets" Button
   - Füge die Spreadsheet ID ein
   - Optional: Ändere den Sheet-Namen (Standard: "Gästeliste")
   - Aktiviere "Automatische Synchronisation"
   - Klicke auf "Speichern"

2. **Manuelle Synchronisation**
   - **Zu Google Sheets**: Klicke auf "📤 Zu Sheets" Button
   - **Von Google Sheets**: Klicke auf "📥 Von Sheets" Button

3. **Automatische Synchronisation**
   - Wenn aktiviert, wird automatisch synchronisiert bei:
     - Hinzufügen eines neuen Gastes
     - Bearbeiten eines Gastes
     - Löschen eines Gastes

## Google Sheets Format

Das Google Sheet sollte folgende Spalten haben (wird automatisch erstellt):

| Name | E-Mail | Telefon | Titel | Organisation | Tischnummer | VIP | Status | Benötigt Empfang | Empfang von | Anreisedatum | Notizen |
|------|--------|---------|-------|--------------|-------------|-----|--------|------------------|-------------|--------------|---------|

## Fehlerbehebung

### "Verbindung zu Google Sheets fehlgeschlagen"
- Prüfe ob die Spreadsheet ID korrekt ist
- Prüfe ob der Service Account Zugriff auf das Sheet hat
- Prüfe ob `GOOGLE_SERVICE_ACCOUNT` korrekt in `.env` gesetzt ist

### "Permission denied"
- Stelle sicher, dass der Service Account "Editor" Berechtigung hat
- Prüfe ob das Sheet nicht gelöscht wurde

### "Sheet not found"
- Prüfe ob der Sheet-Name korrekt ist (Groß-/Kleinschreibung beachten)
- Standard-Name ist "Gästeliste"

## Sicherheit

⚠️ **Wichtig**: 
- Die `GOOGLE_SERVICE_ACCOUNT` JSON enthält sensible Daten
- Niemals in Git committen
- Nur in Environment Variables speichern
- Auf Railway/Vercel als Environment Variable setzen

## Beispiel .env

```env
# Google Sheets Service Account (JSON als String)
GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"my-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"iftar-sync@my-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# Oder API Key (nur für öffentliche Sheets)
# GOOGLE_API_KEY=AIzaSy...
```
