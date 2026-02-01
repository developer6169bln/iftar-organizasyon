-- ============================================================
-- RAILWAY: Projekte-Tabelle einmal anlegen (vereinfacht)
-- ============================================================
--
-- So geht's:
-- 1. Railway öffnen → dein Projekt → Postgres (Datenbank) anklicken
-- 2. Tab "Query" oder "Data" → "New Query" / SQL-Eingabe
-- 3. ALLES unten von "-- Start" bis "-- Ende" kopieren und einfügen
-- 4. Auf "Run" / "Execute" klicken
-- 5. Fertig. "Query returned no rows" ist OK – Tabelle wurde trotzdem angelegt.
--
-- ============================================================
-- Start – alles markieren und ausführen
-- ============================================================

CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_ownerId_fkey') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Prüfung: Wenn du eine Zeile mit "OK" siehst, hat es geklappt
SELECT 'OK – Tabelle projects angelegt' AS status;

-- Ende
