-- ============================================
-- SCHRITT 6: Prisma-Migration als angewendet markieren
-- Verhindert, dass "prisma migrate deploy" die Migration erneut ausführt.
-- ============================================

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT
  gen_random_uuid()::text,
  '',
  NOW(),
  '20260212120000_add_main_user_categories',
  NULL,
  NULL,
  NOW(),
  1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260212120000_add_main_user_categories');

-- Keine Zeilen-Ausgabe bei INSERT mit WHERE NOT EXISTS – bei Erfolg keine Fehlermeldung.
