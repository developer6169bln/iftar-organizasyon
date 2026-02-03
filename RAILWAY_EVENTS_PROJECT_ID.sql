-- ============================================================
-- RAILWAY: Spalte projectId in events anlegen (wenn GET /api/events?projectId=... 500 liefert)
-- ============================================================
--
-- Fehlermeldung war: "Spalte events.projectId fehlt in der Datenbank"
-- → Dieses Skript einmal in Railway ausführen (Postgres → Query / New Query).
--
-- 1. Railway → Postgres → Query
-- 2. Alles unten von "-- Start" bis "-- Ende" einfügen und ausführen
--
-- ============================================================
-- Start
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "projectId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_projectId_fkey') THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Bestehende Events dem ersten Projekt zuordnen (optional)
UPDATE "events"
SET "projectId" = (SELECT id FROM "projects" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "projectId" IS NULL;

SELECT 'OK – events.projectId angelegt' AS status;

-- Ende
