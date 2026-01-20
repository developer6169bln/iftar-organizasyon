# GitHub Upload-Anleitung

## 📋 Schritt-für-Schritt Anleitung

### Schritt 1: GitHub Repository erstellen

1. Gehe zu https://github.com und logge dich ein (oder erstelle einen Account)
2. Klicke auf das **"+"** Symbol oben rechts → **"New repository"**
3. Fülle aus:
   - **Repository name**: `iftar-organizasyon` (oder ein anderer Name)
   - **Description**: "Iftar Organizasyon Web Application"
   - **Visibility**: Wähle **Public** (kostenlos) oder **Private**
   - **WICHTIG**: Lasse "Initialize this repository with a README" **NICHT** angehakt
4. Klicke auf **"Create repository"**

---

### Schritt 2: Lokale Änderungen committen

Führe diese Befehle im Terminal aus (im Projektordner):

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon

# Alle Änderungen hinzufügen
git add .

# Commit erstellen
git commit -m "Initial commit: Iftar Organizasyon App"

# Prüfen, ob alles hinzugefügt wurde
git status
```

---

### Schritt 3: GitHub Repository verbinden

Nachdem du das Repository auf GitHub erstellt hast, kopiere die URL (z.B.):
- `https://github.com/dein-username/iftar-organizasyon.git`

Dann führe aus:

```bash
# Remote Repository hinzufügen (ersetze URL mit deiner)
git remote add origin https://github.com/DEIN-USERNAME/iftar-organizasyon.git

# Prüfen, ob es funktioniert hat
git remote -v
```

**Falls bereits ein Remote existiert:**
```bash
# Alten Remote entfernen
git remote remove origin

# Neuen Remote hinzufügen
git remote add origin https://github.com/DEIN-USERNAME/iftar-organizasyon.git
```

---

### Schritt 4: Code auf GitHub hochladen

```bash
# Code hochladen (erste Mal)
git push -u origin main

# Bei späteren Änderungen:
git add .
git commit -m "Beschreibung der Änderungen"
git push
```

---

## 🔐 Authentifizierung

GitHub verwendet keine Passwörter mehr. Du musst einen **Personal Access Token** verwenden:

### Token erstellen:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" → "Generate new token (classic)"
3. Name: z.B. "Iftar App Upload"
4. Scopes: Aktiviere **"repo"** (alle Repository-Berechtigungen)
5. "Generate token" klicken
6. **Token kopieren** (wird nur einmal angezeigt!)

### Token verwenden:

Wenn du `git push` ausführst, wird nach Username und Password gefragt:
- **Username**: Dein GitHub-Benutzername
- **Password**: Der Personal Access Token (nicht dein GitHub-Passwort!)

---

## ✅ Checkliste

- [ ] GitHub Account erstellt/angemeldet
- [ ] Neues Repository auf GitHub erstellt
- [ ] Lokale Änderungen committed (`git add .` und `git commit`)
- [ ] Remote Repository hinzugefügt (`git remote add origin`)
- [ ] Personal Access Token erstellt
- [ ] Code hochgeladen (`git push -u origin main`)

---

## 🚨 Wichtige Hinweise

1. **`.env` Datei wird NICHT hochgeladen** (steht in `.gitignore`) - das ist gut!
2. **`node_modules` wird NICHT hochgeladen** - das ist richtig!
3. **Prisma Datenbank-Datei** (`dev.db`) wird NICHT hochgeladen - das ist korrekt!

---

## 📝 Alternative: GitHub CLI (einfacher)

Falls du GitHub CLI installiert hast:

```bash
# Installieren (falls nicht vorhanden)
brew install gh

# Login
gh auth login

# Repository erstellen und hochladen (alles in einem!)
gh repo create iftar-organizasyon --public --source=. --remote=origin --push
```
