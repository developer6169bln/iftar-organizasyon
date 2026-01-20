#!/bin/bash
# Script to update Vercel DATABASE_URL with Supabase Connection Pooling URL

# Supabase Connection Details
PROJECT_REF="civjhriuzgstodqgapxq"
PASSWORD="Yk&14612023!"

# Try common regions (most likely EU Central for European projects)
REGIONS=(
  "aws-0-eu-central-1"
  "aws-0-eu-west-1" 
  "aws-0-us-east-1"
)

echo "🔍 Supabase Connection Pooling URL Generator"
echo "============================================"
echo ""
echo "Project Reference: ${PROJECT_REF}"
echo ""

# Generate Connection Pooling URLs
echo "📋 Connection Pooling URLs (für Vercel):"
echo ""

for REGION in "${REGIONS[@]}"; do
  POOLING_URL="postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${REGION}.pooler.supabase.com:6543/postgres"
  echo "Region: ${REGION}"
  echo "URL: ${POOLING_URL}"
  echo ""
done

echo "✅ Kopiere eine der URLs oben"
echo ""
echo "📝 Nächste Schritte:"
echo "1. Gehe zu Vercel Dashboard → Projekt → Settings → Environment Variables"
echo "2. Finde DATABASE_URL und klicke auf Bearbeiten"
echo "3. Ersetze die URL mit einer der Connection Pooling URLs oben"
echo "4. Speichere und redeploye"
echo ""
echo "💡 Tipp: Beginne mit 'aws-0-eu-central-1' (meist für EU-Projekte)"
