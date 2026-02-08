-- ============================================
-- SCHRITT 4: 14 Hauptbenutzer-Kategorien einfügen
-- Erst ausführen, wenn Schritt 1–3 erfolgreich waren.
-- ============================================

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

-- Prüfung (sollte 14 Zeilen zeigen):
SELECT id, "key", name, "order" FROM main_user_categories ORDER BY "order";
