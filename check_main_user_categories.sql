-- ============================================
-- DIAGNOSE: Existiert die Tabelle main_user_categories?
-- In Railway: PostgreSQL Service → Query → diesen Inhalt einfügen → Run
-- ============================================

-- 1) Alle Tabellen im Schema "public" anzeigen (nach Name sortiert)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2) Existiert main_user_categories?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'main_user_categories'
) AS "Tabelle main_user_categories existiert?";

-- 3) Hat users die Spalte mainUserCategoryId?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 4) Wenn die Tabelle existiert: Einträge zählen
-- (Nur ausführen, wenn Schritt 2 "true" ergab – sonst Fehler)
-- SELECT COUNT(*) AS "Anzahl Kategorien" FROM main_user_categories;
