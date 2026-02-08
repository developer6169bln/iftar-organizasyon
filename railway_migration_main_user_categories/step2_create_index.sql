-- ============================================
-- SCHRITT 2: Eindeutigen Index auf "key" anlegen
-- Erst ausführen, wenn Schritt 1 erfolgreich war.
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "main_user_categories_key_key" ON "main_user_categories"("key");

-- Keine Zeilen-Ausgabe bei CREATE INDEX – bei Erfolg keine Fehlermeldung.
