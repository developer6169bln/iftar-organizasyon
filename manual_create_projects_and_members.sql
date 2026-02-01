-- Projekte & Projektmitarbeiter manuell anlegen
-- Railway: Postgres → Data / Query → SQL einfügen und ausführen
-- Supabase: SQL Editor → New query → einfügen und Run
-- Bei bereits vorhandenen Tabellen/Spalten: entsprechende Blöcke überspringen oder Fehler ignorieren

-- 1) Edition-Limits (Spalten hinzufügen, falls noch nicht da)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'editions' AND column_name = 'maxProjects') THEN
    ALTER TABLE "editions" ADD COLUMN "maxProjects" INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'editions' AND column_name = 'maxProjectStaffPerProject') THEN
    ALTER TABLE "editions" ADD COLUMN "maxProjectStaffPerProject" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2) Tabelle projects
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
    ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Tabelle project_members
CREATE TABLE IF NOT EXISTS "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_projectId_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_userId_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Tabelle project_member_category_permissions
CREATE TABLE IF NOT EXISTS "project_member_category_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_member_category_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_member_category_permissions_projectId_userId_categoryId_key"
  ON "project_member_category_permissions"("projectId", "userId", "categoryId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_member_category_permissions_projectId_userId_fkey') THEN
    ALTER TABLE "project_member_category_permissions" ADD CONSTRAINT "project_member_category_permissions_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) Tabelle project_member_page_permissions
CREATE TABLE IF NOT EXISTS "project_member_page_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_member_page_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_member_page_permissions_projectId_userId_pageId_key"
  ON "project_member_page_permissions"("projectId", "userId", "pageId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_member_page_permissions_projectId_userId_fkey') THEN
    ALTER TABLE "project_member_page_permissions" ADD CONSTRAINT "project_member_page_permissions_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6) Spalte projectId in events (falls noch nicht da)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'projectId') THEN
    ALTER TABLE "events" ADD COLUMN "projectId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_projectId_fkey') THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7) Datenmigration: Ein Projekt "Iftar Organizasyon Sistemi" für yasko1461@gmail.com (oder ersten Admin)
INSERT INTO "projects" ("id", "ownerId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, 'Iftar Organizasyon Sistemi', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT id FROM "users"
  WHERE LOWER(email) = 'yasko1461@gmail.com' OR role = 'ADMIN'
  ORDER BY CASE WHEN LOWER(email) = 'yasko1461@gmail.com' THEN 0 ELSE 1 END
  LIMIT 1
) u(id)
WHERE NOT EXISTS (SELECT 1 FROM "projects" LIMIT 1);

-- 8) Bestehende Events dem ersten Projekt zuordnen
UPDATE "events"
SET "projectId" = (SELECT id FROM "projects" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "projectId" IS NULL;
