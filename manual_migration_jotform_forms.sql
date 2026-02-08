-- ============================================
-- MANUELLE MIGRATION: JotForm-Formulare (Etkinlik Formu, Etkinlik Raporu)
-- ============================================
-- In Railway: PostgreSQL-Service → Query → Inhalt einfügen → Run
-- Oder die Schritte aus dem Ordner railway_migration_jotform_forms/ nacheinander ausführen.
-- ============================================

-- 1. Tabelle jotform_forms
CREATE TABLE IF NOT EXISTS "jotform_forms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "jotformFormId" TEXT,
    "jotformUrl" TEXT,
    "importedAt" TIMESTAMP(3),
    "importedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jotform_forms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "jotform_forms_projectId_formType_key" ON "jotform_forms"("projectId", "formType");
CREATE INDEX IF NOT EXISTS "jotform_forms_projectId_idx" ON "jotform_forms"("projectId");

-- 2. Tabelle jotform_form_fields
CREATE TABLE IF NOT EXISTS "jotform_form_fields" (
    "id" TEXT NOT NULL,
    "jotFormFormId" TEXT NOT NULL,
    "jotformQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jotform_form_fields_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "jotform_form_fields_jotFormFormId_jotformQuestionId_key" ON "jotform_form_fields"("jotFormFormId", "jotformQuestionId");
CREATE INDEX IF NOT EXISTS "jotform_form_fields_jotFormFormId_idx" ON "jotform_form_fields"("jotFormFormId");

-- 3. Tabelle jotform_submissions
CREATE TABLE IF NOT EXISTS "jotform_submissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventId" TEXT,
    "formType" TEXT NOT NULL,
    "enteredByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "jotformSubmissionId" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jotform_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "jotform_submissions_projectId_idx" ON "jotform_submissions"("projectId");
CREATE INDEX IF NOT EXISTS "jotform_submissions_eventId_idx" ON "jotform_submissions"("eventId");
CREATE INDEX IF NOT EXISTS "jotform_submissions_formType_idx" ON "jotform_submissions"("formType");
CREATE INDEX IF NOT EXISTS "jotform_submissions_submittedAt_idx" ON "jotform_submissions"("submittedAt");

-- 4. Tabelle project_member_jotform_permissions
CREATE TABLE IF NOT EXISTS "project_member_jotform_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSubmitToJotform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_member_jotform_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_member_jotform_permissions_projectId_userId_key" ON "project_member_jotform_permissions"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "project_member_jotform_permissions_projectId_idx" ON "project_member_jotform_permissions"("projectId");

-- 5. Foreign Keys (nur anlegen, falls noch nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_forms' AND constraint_name = 'jotform_forms_projectId_fkey') THEN
    ALTER TABLE "jotform_forms" ADD CONSTRAINT "jotform_forms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_forms' AND constraint_name = 'jotform_forms_importedByUserId_fkey') THEN
    ALTER TABLE "jotform_forms" ADD CONSTRAINT "jotform_forms_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_form_fields' AND constraint_name = 'jotform_form_fields_jotFormFormId_fkey') THEN
    ALTER TABLE "jotform_form_fields" ADD CONSTRAINT "jotform_form_fields_jotFormFormId_fkey" FOREIGN KEY ("jotFormFormId") REFERENCES "jotform_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_submissions' AND constraint_name = 'jotform_submissions_projectId_fkey') THEN
    ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_submissions' AND constraint_name = 'jotform_submissions_eventId_fkey') THEN
    ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_submissions' AND constraint_name = 'jotform_submissions_enteredByUserId_fkey') THEN
    ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'jotform_submissions' AND constraint_name = 'jotform_submissions_submittedByUserId_fkey') THEN
    ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'project_member_jotform_permissions' AND constraint_name = 'project_member_jotform_permissions_projectId_fkey') THEN
    ALTER TABLE "project_member_jotform_permissions" ADD CONSTRAINT "project_member_jotform_permissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'project_member_jotform_permissions' AND constraint_name = 'project_member_jotform_permissions_userId_fkey') THEN
    ALTER TABLE "project_member_jotform_permissions" ADD CONSTRAINT "project_member_jotform_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Prisma-Migration als angewendet markieren
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '', NOW(), '20260215120000_add_jotform_forms', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260215120000_add_jotform_forms');

-- 7. Prüfung
SELECT 'OK' AS status, 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jotform_forms') AS jotform_forms_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_member_jotform_permissions') AS permissions_exists;
