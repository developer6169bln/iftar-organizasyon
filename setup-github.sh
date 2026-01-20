#!/bin/bash

# GitHub Remote Setup Script
# Führe dieses Skript aus: bash setup-github.sh

echo "🚀 GitHub Remote Konfiguration"
echo "================================"
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

# Frage nach GitHub Username
read -p "Gib deinen GitHub Username ein: " github_username

if [ -z "$github_username" ]; then
    echo "❌ Username darf nicht leer sein!"
    exit 1
fi

# Frage nach Repository Name
read -p "Repository Name (Standard: iftar-organizasyon): " repo_name
repo_name=${repo_name:-iftar-organizasyon}

# Konfiguriere Git User (falls nicht gesetzt)
if [ -z "$(git config user.name)" ]; then
    read -p "Git Name (für Commits): " git_name
    if [ -n "$git_name" ]; then
        git config user.name "$git_name"
    fi
fi

if [ -z "$(git config user.email)" ]; then
    read -p "Git Email (für Commits): " git_email
    if [ -n "$git_email" ]; then
        git config user.email "$git_email"
    fi
fi

# Remote hinzufügen
echo ""
echo "📡 Füge GitHub Remote hinzu..."
git remote add origin "https://github.com/${github_username}/${repo_name}.git"

echo ""
echo "✅ GitHub Remote erfolgreich konfiguriert!"
echo ""
echo "Remote URL: https://github.com/${github_username}/${repo_name}.git"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Erstelle das Repository auf GitHub: https://github.com/new"
echo "   - Name: ${repo_name}"
echo "   - Lasse 'Initialize with README' NICHT angehakt"
echo ""
echo "2. Lade den Code hoch:"
echo "   git push -u origin main"
echo ""
echo "3. Bei der Authentifizierung:"
echo "   - Username: ${github_username}"
echo "   - Password: Dein Personal Access Token (nicht dein GitHub-Passwort!)"
echo ""
