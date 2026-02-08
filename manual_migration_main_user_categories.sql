-- ============================================
-- MANUELLE MIGRATION: Hauptbenutzer-Kategorien (main_user_categories)
-- ============================================
-- Wenn der Login mit "Datenbank-Migration fehlt" abbricht:
--
-- Option A – In Railway (empfohlen):
--   1. Railway Dashboard → dein Projekt → PostgreSQL Service (Datenbank)
--   2. Tab "Data" oder "Query" → "New Query" / "Query"
--   3. Gesamten Inhalt dieser Datei einfügen und ausführen (Run)
--   4. Login in der App erneut versuchen
--
-- Option B – Lokal mit Railway CLI:
--   railway link && railway run npx prisma migrate deploy
-- ============================================

-- 1. Tabelle anlegen (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS "main_user_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "main_user_categories_pkey" PRIMARY KEY ("id")
);

-- 2. Eindeutigen Index auf key (falls nicht vorhanden)
CREATE UNIQUE INDEX IF NOT EXISTS "main_user_categories_key_key" ON "main_user_categories"("key");

-- 3. Spalte mainUserCategoryId in users (falls nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'mainUserCategoryId'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "mainUserCategoryId" TEXT;
  END IF;
END $$;

-- 4. 14 Kategorien einfügen (überspringen, wenn key schon existiert)
INSERT INTO "main_user_categories" ("id", "key", "name", "order", "createdAt", "updatedAt") VALUES
  ('maincat-1-baskan', 'BASKAN', 'Baskan', 1, NOW(), NOW()),
  ('maincat-2-sekreter', 'SEKRETER', 'Sekreter', 2, NOW(), NOW()),
  ('maincat-3-teskilatlanma', 'TESKILATLANMA', 'Teskilatlanma', 3, NOW(), NOW()),
  ('maincat-4-mali-idari', 'MALI_IDARI', 'Mali Idari', 4, NOW(), NOW()),
  ('maincat-5-halkla-iliskiler', 'HALKLA_ILISKILER', 'Halkla Iliskiler', 5, NOW(), NOW()),
  ('maincat-6-siyasi-iliskiler', 'SIYASI_ILISKILER', 'Siyasi Iliskiler', 6, NOW(), NOW()),
  ('maincat-7-kadin-kollari', 'KADIN_KOLLARI', 'Kadin Kollari', 7, NOW(), NOW()),
  ('maincat-8-genclik-kollari', 'GENCLIK_KOLLARI', 'Genclik Kollari', 8, NOW(), NOW()),
  ('maincat-9-arge-egitim', 'ARGE_VE_EGITIM', 'Arge ve Egitim', 9, NOW(), NOW()),
  ('maincat-10-stk-birimi', 'STK_BIRIMI', 'STK Birimi', 10, NOW(), NOW()),
  ('maincat-11-tanitim-medya', 'TANITIM_MEDYA', 'Tanitim Medya', 11, NOW(), NOW()),
  ('maincat-12-kultur-sanat', 'KULTUR_VE_SANAT', 'Kultur ve Sanat', 12, NOW(), NOW()),
  ('maincat-13-aile-sosyal', 'AILE_VE_SOSYAL', 'Aile ve Sosyal', 13, NOW(), NOW()),
  ('maincat-14-hukuk-isler', 'HUKUK_ISLER', 'Hukuk Isler', 14, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- 5. Foreign Key von users zu main_user_categories (falls nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'users' AND constraint_name = 'users_mainUserCategoryId_fkey'
  ) THEN
    ALTER TABLE "users"
    ADD CONSTRAINT "users_mainUserCategoryId_fkey"
    FOREIGN KEY ("mainUserCategoryId") REFERENCES "main_user_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Prisma-Migration als angewendet markieren (damit "migrate deploy" sie nicht erneut ausführt)
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
