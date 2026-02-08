-- CreateTable: Hauptbenutzer-Kategorien (später Berechtigungen pro Kategorie)
CREATE TABLE "main_user_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "main_user_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "main_user_categories_key_key" ON "main_user_categories"("key");

-- AddColumn: User.mainUserCategoryId
ALTER TABLE "users" ADD COLUMN "mainUserCategoryId" TEXT;

-- Insert 14 Kategorien
INSERT INTO "main_user_categories" ("id", "key", "name", "order", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'BASKAN', 'Baskan', 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'SEKRETER', 'Sekreter', 2, NOW(), NOW()),
  (gen_random_uuid()::text, 'TESKILATLANMA', 'Teskilatlanma', 3, NOW(), NOW()),
  (gen_random_uuid()::text, 'MALI_IDARI', 'Mali Idari', 4, NOW(), NOW()),
  (gen_random_uuid()::text, 'HALKLA_ILISKILER', 'Halkla Iliskiler', 5, NOW(), NOW()),
  (gen_random_uuid()::text, 'SIYASI_ILISKILER', 'Siyasi Iliskiler', 6, NOW(), NOW()),
  (gen_random_uuid()::text, 'KADIN_KOLLARI', 'Kadin Kollari', 7, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENCLIK_KOLLARI', 'Genclik Kollari', 8, NOW(), NOW()),
  (gen_random_uuid()::text, 'ARGE_VE_EGITIM', 'Arge ve Egitim', 9, NOW(), NOW()),
  (gen_random_uuid()::text, 'STK_BIRIMI', 'STK Birimi', 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'TANITIM_MEDYA', 'Tanitim Medya', 11, NOW(), NOW()),
  (gen_random_uuid()::text, 'KULTUR_VE_SANAT', 'Kultur ve Sanat', 12, NOW(), NOW()),
  (gen_random_uuid()::text, 'AILE_VE_SOSYAL', 'Aile ve Sosyal', 13, NOW(), NOW()),
  (gen_random_uuid()::text, 'HUKUK_ISLER', 'Hukuk Isler', 14, NOW(), NOW());

ALTER TABLE "users" ADD CONSTRAINT "users_mainUserCategoryId_fkey" FOREIGN KEY ("mainUserCategoryId") REFERENCES "main_user_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
