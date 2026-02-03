# Railway: Prüfen, warum nach Push nichts passiert

**Push funktioniert:** Dein `git push origin main` landet auf GitHub (Branch **main**). Wenn bei Railway trotzdem nichts passiert, liegt es an der **Verbindung Railway ↔ GitHub**, nicht am Push.

---

## 0. Schnell-Fix: Manuell auf Railway deployen

1. **Railway Dashboard** → https://railway.app/dashboard  
2. Dein **Projekt** → den **Web-Service** (nicht Postgres) öffnen.  
3. Tab **Deployments** → oben **„Redeploy“** / **„New Deployment“** klicken.  
4. **„Deploy from main“** (oder „Use latest commit“) wählen → Railway baut den **aktuellen Stand von GitHub** und deployed ihn.

Damit siehst du sofort den neuesten Code, auch wenn „Deploy on push“ nicht ausgelöst wurde.

---

## 1. Prüfen, ob der Push auf GitHub angekommen ist

- Repo: **https://github.com/developer6169bln/iftar-organizasyon**
- Branch: **main**
- Letzter Commit sollte z. B. „Admin-Bereich für Hauptnutzer…“ heißen.

Wenn du auf GitHub unter **Code → Commits** den neuesten Commit siehst, ist der Push in Ordnung.

---

## 2. Railway: Wird dieses Repo verwendet?

1. **Railway Dashboard** öffnen: https://railway.app/dashboard
2. Dein **Projekt** auswählen.
3. Den **Service** (z. B. „Web“ oder „iftar-organizasyon“) anklicken.
4. Tab **Settings** (oder **Einstellungen**):
   - Unter **Source** / **GitHub** prüfen:
     - Ist **dieses** Repo verbunden? (`developer6169bln/iftar-organizasyon`)
     - Ist der Branch **main** eingestellt?
   - Wenn **„No repository connected“** steht → GitHub-Repo verbinden („Connect Repo“ / „Connect GitHub“).

---

## 3. Deploy bei Push aktiv?

- In den **Service-Settings** nach **Deploy** / **Triggers** suchen.
- Es sollte **„Deploy on push“** oder **„Deploy when branch is updated“** aktiviert sein (für Branch **main**).
- Falls deaktiviert: aktivieren und erneut auf **main** pushen oder manuell deployen.

---

## 4. Manuellen Deploy auslösen

Auch ohne neuen Push kannst du ein neues Deploy starten:

1. Im Railway-Dashboard den **Service** öffnen.
2. Tab **Deployments** (oder **Deploys**).
3. Oben **„Deploy“** / **„Redeploy“** / **„New Deployment“** wählen.
4. Wenn nötig: **„Deploy from main“** (oder deinen Branch) wählen.

Dann wird der **aktuelle Stand von GitHub** (inkl. deines letzten Pushes) gebaut und deployed.

---

## 5. Letztes Deploy prüfen

- Unter **Deployments** das **neueste Deployment** anklicken.
- **Status:** Success / Failed / Building?
- Bei **Failed:** **Build-Logs** / **Logs** öffnen und die Fehlermeldung lesen (z. B. TypeScript, fehlende Env-Vars, Build-Timeout).

---

## 6. Kurz-Checkliste

| Schritt | Erledigt? |
|--------|-----------|
| Push auf GitHub (Branch `main`) sichtbar? | |
| In Railway: richtiges Repo + Branch `main` verbunden? | |
| „Deploy on push“ für `main` aktiv? | |
| Neuestes Deployment in Railway auf „Success“? | |
| Bei Fehler: Build-Logs gelesen? | |

Wenn das Repo verbunden ist und „Deploy on push“ für **main** an ist, löst jeder `git push origin main` ein neues Deployment aus. Sonst: **Redeploy** manuell starten (siehe Abschnitt 4).

---

## 7. GitHub Actions: Push sichtbar machen

Im Projekt gibt es eine **GitHub Action** (`.github/workflows/build.yml`): Bei jedem **Push auf main** läuft auf GitHub ein Build. Unter **GitHub → dein Repo → Actions** siehst du, ob der Push angekommen ist und der Build grün ist. Wenn der Build grün ist, ist der Code in Ordnung – dann liegt das Problem nur bei der Railway-Verbindung (Repo/Branch/Deploy on push) oder du löst **Redeploy** manuell aus (Abschnitt 0).
