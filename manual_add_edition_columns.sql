-- Nur die fehlenden Spalten in "editions" hinzufügen
-- Railway/Supabase: SQL ausführen. Bei "column already exists" ignorieren (Spalte war schon da).

-- PostgreSQL 11+: mit IF NOT EXISTS (bei Fehler die beiden Zeilen unten stattdessen einmal ausführen)
ALTER TABLE "editions" ADD COLUMN IF NOT EXISTS "maxProjects" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "editions" ADD COLUMN IF NOT EXISTS "maxProjectStaffPerProject" INTEGER NOT NULL DEFAULT 0;

-- Falls IF NOT EXISTS nicht unterstützt wird, nur diese zwei Zeilen ausführen (einmalig):
-- ALTER TABLE "editions" ADD COLUMN "maxProjects" INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE "editions" ADD COLUMN "maxProjectStaffPerProject" INTEGER NOT NULL DEFAULT 0;
