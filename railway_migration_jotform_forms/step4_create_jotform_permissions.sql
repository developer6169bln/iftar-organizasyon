-- SCHRITT 4: Tabelle project_member_jotform_permissions anlegen

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

SELECT 'project_member_jotform_permissions angelegt' AS status;
