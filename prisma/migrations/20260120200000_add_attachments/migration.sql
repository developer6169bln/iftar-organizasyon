-- CreateTable
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "checklistItemId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "checklist_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attachments_taskId_idx" ON "attachments"("taskId");
CREATE INDEX IF NOT EXISTS "attachments_checklistItemId_idx" ON "attachments"("checklistItemId");
