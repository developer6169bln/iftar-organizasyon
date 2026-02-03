-- ============================================================
-- RAILWAY: Tabelle project_members anlegen (wenn nur "projects" existiert)
-- ============================================================
--
-- Fehlermeldung war: "The table public.project_members does not exist"
-- → Dieses Skript einmal in Railway ausführen (Postgres → Query / Data → New Query).
--
-- 1. Railway öffnen → dein Projekt → Postgres (Datenbank)
-- 2. Tab "Query" oder "Data" → "New Query" / SQL-Eingabe
-- 3. Alles unten von "-- Start" bis "-- Ende" einfügen und ausführen
--
-- ============================================================
-- Start
-- ============================================================

CREATE TABLE IF NOT EXISTS "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_members_projectId_userId_key"
  ON "project_members"("projectId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_projectId_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_userId_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Berechtigungstabellen (für „Bearbeiten“ der Mitglieder)
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
    ALTER TABLE "project_member_category_permissions"
      ADD CONSTRAINT "project_member_category_permissions_projectId_userId_fkey"
      FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

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
    ALTER TABLE "project_member_page_permissions"
      ADD CONSTRAINT "project_member_page_permissions_projectId_userId_fkey"
      FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

SELECT 'OK – project_members und Berechtigungstabellen angelegt' AS status;

-- Ende
