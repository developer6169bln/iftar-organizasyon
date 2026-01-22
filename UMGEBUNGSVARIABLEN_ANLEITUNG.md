# Umgebungsvariablen setzen - Schritt für Schritt

## 1. Lokal (auf deinem Computer)

### Schritt 1: .env Datei erstellen/bearbeiten

Im Projekt-Root-Verzeichnis (`/Users/yasinkorkot/new-project/iftar-organizasyon/`) erstelle oder bearbeite die Datei `.env`:

```bash
cd /Users/yasinkorkot/new-project/iftar-organizasyon
nano .env
# oder
code .env
```

### Schritt 2: VAPID Keys hinzufügen

Füge diese Zeilen zur `.env` Datei hinzu:

```env
# VAPID Keys für Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=deine_public_key_hier
VAPID_PRIVATE_KEY=deine_private_key_hier
VAPID_EMAIL=mailto:deine-email@example.com
```

**Beispiel:**
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEFM-wEA9LbUArQPnpognukcbiG036Kn2ARbviFMc4Q_WTBlqKILAW_8ISXHz6xKHopTwxxLL4J66toTwQUq-sY
VAPID_PRIVATE_KEY=aJGEw1aoQQAFMgtdd-wUufm6MzLhYovyGlpQeEBEbi8
VAPID_EMAIL=mailto:admin@iftar-organizasyon.de
```

### Schritt 3: Speichern

Speichere die Datei. Die Variablen werden beim nächsten `npm run dev` automatisch geladen.

---

## 2. Auf Railway (Production)

### Schritt 1: Railway Dashboard öffnen

1. Gehe zu: https://railway.app/
2. Logge dich ein
3. Wähle dein Projekt: `iftar-organizasyon`

### Schritt 2: Environment Variables öffnen

1. Klicke auf deinen **Service** (z.B. "iftar-organizasyon-production")
2. Gehe zum Tab **"Variables"** (oder klicke auf **"Settings"** → **"Variables"**)

### Schritt 3: Variablen hinzufügen

Klicke auf **"+ New Variable"** und füge jede Variable einzeln hinzu:

**Variable 1:**
- **Name:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **Value:** `deine_public_key_hier`
- Klicke auf **"Add"**

**Variable 2:**
- **Name:** `VAPID_PRIVATE_KEY`
- **Value:** `deine_private_key_hier`
- Klicke auf **"Add"`

**Variable 3:**
- **Name:** `VAPID_EMAIL`
- **Value:** `mailto:deine-email@example.com`
- Klicke auf **"Add"**

### Schritt 4: Deployment

Nach dem Hinzufügen der Variablen:
- Railway startet automatisch ein neues Deployment
- Oder klicke manuell auf **"Redeploy"**

---

## 3. Prüfen ob Variablen gesetzt sind

### Lokal testen:

```bash
# Starte den Dev-Server
npm run dev

# Öffne die Browser-Konsole und prüfe:
# Die Push Notification Komponente sollte funktionieren
```

### Auf Railway prüfen:

1. Gehe zu **Settings** → **Variables**
2. Prüfe ob alle 3 Variablen vorhanden sind
3. Prüfe die Logs nach dem Deployment

---

## 4. Wichtige Hinweise

### ✅ RICHTIG:
- `NEXT_PUBLIC_*` Variablen sind im Frontend verfügbar (Browser)
- `VAPID_PRIVATE_KEY` ist NUR im Backend (nie im Frontend!)
- Beide müssen gesetzt sein, sonst funktionieren Push Notifications nicht

### ❌ FALSCH:
- `VAPID_PRIVATE_KEY` NICHT in Client-Code verwenden
- Keys NICHT in Git committen (`.env` ist in `.gitignore`)
- Keys NICHT öffentlich teilen

---

## 5. Troubleshooting

### Problem: "VAPID Public Key nicht konfiguriert"
**Lösung:** Prüfe ob `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env` steht

### Problem: "VAPID Keys nicht konfiguriert" (API)
**Lösung:** Prüfe ob `VAPID_PRIVATE_KEY` in `.env` steht

### Problem: Keys funktionieren lokal, aber nicht auf Railway
**Lösung:** 
1. Prüfe Railway Variables
2. Stelle sicher, dass alle 3 Variablen gesetzt sind
3. Redeploy das Projekt

---

## 6. Schnellstart

```bash
# 1. Keys generieren
npm run generate-vapid-keys

# 2. Keys in .env kopieren (lokal)
# 3. Keys in Railway Variables kopieren (Production)
# 4. Fertig!
```
