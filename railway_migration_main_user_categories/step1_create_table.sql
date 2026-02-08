-- ============================================
-- SCHRITT 1: Leere Tabelle main_user_categories anlegen
-- In Railway: PostgreSQL → Query → Inhalt einfügen → Run
-- ============================================

CREATE TABLE IF NOT EXISTS "main_user_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "main_user_categories_pkey" PRIMARY KEY ("id")
);

-- Prüfung (sollte 0 Zeilen zeigen, Tabelle ist noch leer):
SELECT COUNT(*) AS anzahl FROM main_user_categories;
