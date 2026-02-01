-- AlterTable: Edition-Limits für Hauptaccounts (Projekte, Projektmitarbeiter)
ALTER TABLE "editions" ADD COLUMN "maxProjects" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "editions" ADD COLUMN "maxProjectStaffPerProject" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: Projekte (ein Projekt pro Hauptaccount, z.B. "Iftar Organizasyon Sistemi")
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Projektmitarbeiter
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Kategorie-Berechtigungen pro Projektmitarbeiter
CREATE TABLE "project_member_category_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_category_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_member_category_permissions_projectId_userId_categoryId_key" ON "project_member_category_permissions"("projectId", "userId", "categoryId");
ALTER TABLE "project_member_category_permissions" ADD CONSTRAINT "project_member_category_permissions_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Seiten-Berechtigungen pro Projektmitarbeiter
CREATE TABLE "project_member_page_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_page_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_member_page_permissions_projectId_userId_pageId_key" ON "project_member_page_permissions"("projectId", "userId", "pageId");
ALTER TABLE "project_member_page_permissions" ADD CONSTRAINT "project_member_page_permissions_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "project_members"("projectId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Event gehört zu einem Projekt
ALTER TABLE "events" ADD COLUMN "projectId" TEXT;

ALTER TABLE "events" ADD CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: Ein Standard-Projekt "Iftar Organizasyon Sistemi" für yasko1461@gmail.com (oder ersten Admin) anlegen
INSERT INTO "projects" ("id", "ownerId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, 'Iftar Organizasyon Sistemi', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT id FROM "users"
  WHERE LOWER(email) = 'yasko1461@gmail.com' OR role = 'ADMIN'
  ORDER BY CASE WHEN LOWER(email) = 'yasko1461@gmail.com' THEN 0 ELSE 1 END
  LIMIT 1
) u(id)
WHERE NOT EXISTS (SELECT 1 FROM "projects" LIMIT 1);

-- Alle bestehenden Events dem (einzigen) Projekt zuordnen
UPDATE "events"
SET "projectId" = (SELECT id FROM "projects" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "projectId" IS NULL;
