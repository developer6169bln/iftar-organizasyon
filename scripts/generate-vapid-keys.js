#!/usr/bin/env node

/**
 * Script zum Generieren von VAPID Keys für Push Notifications
 * 
 * Verwendung:
 *   node scripts/generate-vapid-keys.js
 * 
 * Oder mit npm:
 *   npm run generate-vapid-keys
 */

const webpush = require('web-push');

console.log('🔑 Generiere VAPID Keys...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys erfolgreich generiert!\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n📋 Füge diese Keys zu deinen Umgebungsvariablen hinzu:\n');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('VAPID_EMAIL=mailto:deine-email@example.com');
console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('⚠️  WICHTIG:');
console.log('   - Kopiere diese Keys sicher!');
console.log('   - VAPID_PRIVATE_KEY NUR im Backend verwenden!');
console.log('   - Füge sie zu .env (lokal) und Railway Environment Variables hinzu\n');
