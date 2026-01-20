# GitHub Remote manuell konfigurieren

## Option 1: Mit Skript (Einfach)

```bash
bash setup-github.sh
```

Das Skript fragt dich nach:
- GitHub Username
- Repository Name
- Git Name und Email (falls noch nicht gesetzt)

---

## Option 2: Manuell (Schritt für Schritt)

### 1. Git Name und Email setzen (falls noch nicht gesetzt)

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon

git config user.name "Dein Name"
git config user.email "deine-email@example.com"
```

### 2. GitHub Remote hinzufügen

**Ersetze `DEIN-USERNAME` mit deinem GitHub-Username:**

```bash
git remote add origin https://github.com/DEIN-USERNAME/iftar-organizasyon.git
```

**Falls bereits ein Remote existiert:**

```bash
# Altes Remote entfernen
git remote remove origin

# Neues Remote hinzufügen
git remote add origin https://github.com/DEIN-USERNAME/iftar-organizasyon.git
```

### 3. Remote prüfen

```bash
git remote -v
```

Sollte zeigen:
```
origin  https://github.com/DEIN-USERNAME/iftar-organizasyon.git (fetch)
origin  https://github.com/DEIN-USERNAME/iftar-organizasyon.git (push)
```

### 4. Code hochladen

```bash
git push -u origin main
```

---

## Beispiel

```bash
# Beispiel mit Username "yasinkorkot"
git remote add origin https://github.com/yasinkorkot/iftar-organizasyon.git
git remote -v
git push -u origin main
```

---

## Wichtig: Personal Access Token

GitHub verwendet keine Passwörter mehr. Du brauchst einen **Personal Access Token**:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" → "Generate new token (classic)"
3. Name: z.B. "Iftar App"
4. Scopes: Aktiviere **"repo"**
5. "Generate token" → **Token kopieren** (wird nur einmal angezeigt!)

Bei `git push`:
- **Username**: Dein GitHub-Username
- **Password**: Der Personal Access Token
