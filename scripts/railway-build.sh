#!/bin/bash
# Railway Build Script
# Prüft ob DATABASE_URL gesetzt ist und führt Migrationen aus

set -e

echo "🔨 Building application..."

# Prisma Client generieren
echo "📦 Generating Prisma Client..."
npx prisma generate

# Migrationen ausführen (nur wenn DATABASE_URL gesetzt ist)
if [ -n "$DATABASE_URL" ]; then
  echo "🗄️  DATABASE_URL found, running migrations..."
  npx prisma migrate deploy || echo "⚠️  Migration failed, continuing build..."
else
  echo "⚠️  DATABASE_URL not set, skipping migrations"
  echo "💡 Make sure to set DATABASE_URL in Railway Variables"
fi

# Next.js Build
echo "🏗️  Building Next.js application..."
npm run build:next || next build
