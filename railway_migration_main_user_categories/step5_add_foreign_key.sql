-- ============================================
-- SCHRITT 5: Foreign Key von users zu main_user_categories anlegen
-- Erst ausführen, wenn Schritt 1–4 erfolgreich waren (Tabelle muss Daten haben).
-- ============================================

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

-- Prüfung: Constraint sollte erscheinen
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'users' AND constraint_name = 'users_mainUserCategoryId_fkey';
