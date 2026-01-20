#!/bin/bash

# Schnelle GitHub Remote Konfiguration
# Verwendung: bash setup-github-quick.sh DEIN-GITHUB-USERNAME [REPOSITORY-NAME]

if [ -z "$1" ]; then
    echo "❌ Fehler: GitHub Username fehlt!"
    echo ""
    echo "Verwendung:"
    echo "  bash setup-github-quick.sh DEIN-GITHUB-USERNAME"
    echo "  bash setup-github-quick.sh DEIN-GITHUB-USERNAME repository-name"
    echo ""
    echo "Beispiel:"
    echo "  bash setup-github-quick.sh yasinkorkot"
    echo "  bash setup-github-quick.sh yasinkorkot iftar-organizasyon"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME=${2:-iftar-organizasyon}

echo "🚀 Konfiguriere GitHub Remote..."
echo "Username: $GITHUB_USERNAME"
echo "Repository: $REPO_NAME"
echo ""

# Prüfe ob bereits ein Remote existiert
if git remote -v | grep -q "origin"; then
    echo "⚠️  Ein Remote 'origin' existiert bereits:"
    git remote -v
    echo ""
    read -p "Möchtest du es ersetzen? (j/n): " replace
    if [ "$replace" = "j" ] || [ "$replace" = "J" ] || [ "$replace" = "y" ] || [ "$replace" = "Y" ]; then
        git remote remove origin
        echo "✅ Altes Remote entfernt"
    else
        echo "❌ Abgebrochen"
        exit 1
    fi
fi

# Remote hinzufügen
git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "✅ GitHub Remote erfolgreich konfiguriert!"
echo ""
echo "Remote URL: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Erstelle das Repository auf GitHub: https://github.com/new"
echo "   - Name: ${REPO_NAME}"
echo "   - Lasse 'Initialize with README' NICHT angehakt"
echo ""
echo "2. Lade den Code hoch:"
echo "   git push -u origin main"
echo ""
