-- CreateTable: JotForm-Formulare (Etkinlik Formu, Etkinlik Raporu) pro Projekt
CREATE TABLE "jotform_forms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "jotformFormId" TEXT,
    "jotformUrl" TEXT,
    "importedAt" TIMESTAMP(3),
    "importedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jotform_forms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jotform_forms_projectId_formType_key" ON "jotform_forms"("projectId", "formType");
CREATE INDEX "jotform_forms_projectId_idx" ON "jotform_forms"("projectId");

-- CreateTable: Felder (aus JotForm importiert)
CREATE TABLE "jotform_form_fields" (
    "id" TEXT NOT NULL,
    "jotFormFormId" TEXT NOT NULL,
    "jotformQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jotform_form_fields_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jotform_form_fields_jotFormFormId_jotformQuestionId_key" ON "jotform_form_fields"("jotFormFormId", "jotformQuestionId");
CREATE INDEX "jotform_form_fields_jotFormFormId_idx" ON "jotform_form_fields"("jotFormFormId");

-- CreateTable: Formular-Einträge (Entwurf oder an JotForm gesendet)
CREATE TABLE "jotform_submissions" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jotform_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "jotform_submissions_projectId_idx" ON "jotform_submissions"("projectId");
CREATE INDEX "jotform_submissions_eventId_idx" ON "jotform_submissions"("eventId");
CREATE INDEX "jotform_submissions_formType_idx" ON "jotform_submissions"("formType");
CREATE INDEX "jotform_submissions_submittedAt_idx" ON "jotform_submissions"("submittedAt");

-- CreateTable: Wer darf an JotForm senden (pro Projekt)
CREATE TABLE "project_member_jotform_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSubmitToJotform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_member_jotform_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_member_jotform_permissions_projectId_userId_key" ON "project_member_jotform_permissions"("projectId", "userId");
CREATE INDEX "project_member_jotform_permissions_projectId_idx" ON "project_member_jotform_permissions"("projectId");

-- AddForeignKey
ALTER TABLE "jotform_forms" ADD CONSTRAINT "jotform_forms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jotform_forms" ADD CONSTRAINT "jotform_forms_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jotform_form_fields" ADD CONSTRAINT "jotform_form_fields_jotFormFormId_fkey" FOREIGN KEY ("jotFormFormId") REFERENCES "jotform_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jotform_submissions" ADD CONSTRAINT "jotform_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_member_jotform_permissions" ADD CONSTRAINT "project_member_jotform_permissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_member_jotform_permissions" ADD CONSTRAINT "project_member_jotform_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
