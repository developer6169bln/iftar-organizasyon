#!/bin/bash

# Push Script für GitHub
# Verwendung: bash push-to-github.sh

echo "🚀 Lade Code auf GitHub hoch..."
echo ""

# Prüfe ob Remote konfiguriert ist
if ! git remote -v | grep -q "origin"; then
    echo "❌ Kein GitHub Remote konfiguriert!"
    echo "Führe zuerst aus: bash setup-github-quick.sh developer6169bln"
    exit 1
fi

# Zeige Remote URL
echo "Remote URL:"
git remote -v | grep origin
echo ""

# Prüfe ob Repository auf GitHub existiert
echo "⚠️  Stelle sicher, dass das Repository auf GitHub erstellt wurde:"
echo "   https://github.com/developer6169bln/iftar-organizasyon"
echo ""
read -p "Ist das Repository bereits erstellt? (j/n): " created

if [ "$created" != "j" ] && [ "$created" != "J" ] && [ "$created" != "y" ] && [ "$created" != "Y" ]; then
    echo ""
    echo "📋 Bitte erstelle zuerst das Repository:"
    echo "   1. Gehe zu: https://github.com/new"
    echo "   2. Repository name: iftar-organizasyon"
    echo "   3. Lasse 'Initialize with README' NICHT angehakt"
    echo "   4. Klicke 'Create repository'"
    echo ""
    exit 1
fi

# Alle Änderungen committen (falls vorhanden)
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "📝 Es gibt uncommitted Änderungen. Committe sie jetzt..."
    git add .
    git commit -m "Add setup scripts and documentation"
fi

# Push ausführen
echo ""
echo "⬆️  Lade Code hoch..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Code erfolgreich auf GitHub hochgeladen!"
    echo ""
    echo "🌐 Repository: https://github.com/developer6169bln/iftar-organizasyon"
else
    echo ""
    echo "❌ Fehler beim Hochladen!"
    echo "Prüfe:"
    echo "  - Ist das Repository auf GitHub erstellt?"
    echo "  - Ist der Personal Access Token korrekt?"
fi
