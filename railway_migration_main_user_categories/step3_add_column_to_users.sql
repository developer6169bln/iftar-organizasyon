-- ============================================
-- SCHRITT 3: Spalte mainUserCategoryId in Tabelle users hinzufügen
-- Erst ausführen, wenn Schritt 1 und 2 erfolgreich waren.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'mainUserCategoryId'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "mainUserCategoryId" TEXT;
  END IF;
END $$;

-- Prüfung: Spalte sollte in der Liste erscheinen
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'mainUserCategoryId';
