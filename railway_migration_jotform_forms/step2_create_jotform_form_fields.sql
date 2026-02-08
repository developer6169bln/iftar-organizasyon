-- SCHRITT 2: Tabelle jotform_form_fields anlegen

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

SELECT 'jotform_form_fields angelegt' AS status;
