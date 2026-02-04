-- Projekt-spezifische Kategorie-Details (Beschreibung/Verantwortlicher)
CREATE TABLE IF NOT EXISTS "project_category_settings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "responsibleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_category_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_category_settings_projectId_categoryId_key" ON "project_category_settings"("projectId", "categoryId");
CREATE INDEX IF NOT EXISTS "project_category_settings_projectId_idx" ON "project_category_settings"("projectId");
CREATE INDEX IF NOT EXISTS "project_category_settings_categoryId_idx" ON "project_category_settings"("categoryId");

DO $$
BEGIN
  ALTER TABLE "project_category_settings" ADD CONSTRAINT "project_category_settings_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- ignore
END $$;

DO $$
BEGIN
  ALTER TABLE "project_category_settings" ADD CONSTRAINT "project_category_settings_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("categoryId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- ignore
END $$;

DO $$
BEGIN
  ALTER TABLE "project_category_settings" ADD CONSTRAINT "project_category_settings_responsibleUserId_fkey"
    FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- ignore
END $$;

