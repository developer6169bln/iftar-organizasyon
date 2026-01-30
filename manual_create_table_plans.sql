-- Tabelle table_plans manuell anlegen
-- Railway: Postgres-Service → Data / Query → alles markieren, ausführen
-- Bei "constraint ... already exists" beim 2. Mal: ignorieren

CREATE TABLE IF NOT EXISTS "table_plans" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "floorPlanUrl" TEXT,
    "planData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "table_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "table_plans_eventId_key" ON "table_plans"("eventId");

ALTER TABLE "table_plans"
ADD CONSTRAINT "table_plans_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
