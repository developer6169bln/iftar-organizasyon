-- ============================================
-- SCHRITT 7: Abschluss-Prüfung
-- Sollte 1 Zeile liefern: status=OK, anzahl_kategorien=14
-- ============================================

SELECT 'OK' AS status, COUNT(*)::text AS anzahl_kategorien FROM main_user_categories;
