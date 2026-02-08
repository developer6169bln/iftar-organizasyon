-- SCHRITT 3: Tabelle jotform_submissions anlegen

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

SELECT 'jotform_submissions angelegt' AS status;
