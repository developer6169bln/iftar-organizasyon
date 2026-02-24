#!/bin/bash
# Railway: Einmalig einloggen + verlinken, dann deployen.
# Im Projektordner ausführen: ./scripts/railway-push.sh

set -e
cd "$(dirname "$0")/.."

echo "1. Railway Login (Browser öffnet sich)…"
railway login

echo "2. Projekt verlinken (Projekt 'iftar-organizasyon' + Service 'Web' wählen)…"
railway link

echo "3. Deploy starten…"
railway up --detach

echo "Fertig. Deployment läuft auf Railway."
