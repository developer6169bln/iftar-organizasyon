-- SCHRITT 5: Foreign Keys anlegen (nur wenn noch nicht vorhanden)

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

SELECT 'Foreign Keys geprüft/angelegt' AS status;
