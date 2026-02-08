-- SCHRITT 1: Tabelle jotform_forms anlegen
-- Railway: PostgreSQL → Query → ausführen

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

SELECT 'jotform_forms angelegt' AS status;
