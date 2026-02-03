# Rollen und Berechtigungen

## App-Betreiber (Administrator)

- **Aktuell:** `yasko1461@gmail.com` (Rolle `ADMIN`)
- **Rechte:** Totale Kontrolle über die App
  - Sieht und bearbeitet alles (alle Benutzer, alle Projekte, alle Events/Gäste/Aufgaben)
  - Kann Hauptnutzer anlegen und ihnen eine Edition zuweisen (Aktivierung)
  - Kann Benutzer bearbeiten (Rolle, Edition, Ablauf, Berechtigungen)
  - Einziger, der Projekte und Benutzer **anderer** Hauptnutzer sehen kann

## Hauptnutzer

- **Entstehung:** Registrierung + Zuweisung einer Edition durch den App-Betreiber (Aktivierung)
- **Rechte:**
  - Sieht **nur** seine eigenen Projekte (keine Projekte anderer Hauptnutzer)
  - Sieht **nur** Benutzer, die in **seinen** Projekten als Mitglieder eingetragen sind (keine anderen Hauptnutzer, keine Benutzer anderer Hauptnutzer)
  - Kann je nach Edition mehrere Projekte anlegen (Limit: `Edition.maxProjects`)
  - Pro Projekt kann er Benutzer (Projektmitarbeiter) hinzufügen und Berechtigungen vergeben (welche Seiten/Kategorien, welche Rolle)
  - Verwaltet ausschließlich seine eigenen Daten

## Projektmitarbeiter

- **Entstehung:** Wird von einem Hauptnutzer zu einem Projekt hinzugefügt (oder registriert und dem Projekt zugewiesen)
- **Rechte:** Nur das, was der Hauptnutzer pro Projekt freigibt (Seiten und Kategorien)
  - Sieht nur die Projekte, in denen er Mitglied ist
  - Sieht nur die Bereiche (Aufgaben, Checklisten, Gästeliste usw.), für die er Berechtigung hat

## Technische Umsetzung

- **GET /api/users:** Admin → alle User; Hauptnutzer → nur User, die in **eigenen** Projekten Mitglied sind (`project.ownerId = userId`)
- **getProjectsForUser:** Admin → alle Projekte; sonst → nur eigene (ownerId = userId) oder Mitglieds-Projekte
- **Registrierung:** Vergibt **keine** Edition automatisch; der App-Betreiber weist per PATCH /api/users eine Edition zu und aktiviert so den Hauptnutzer
