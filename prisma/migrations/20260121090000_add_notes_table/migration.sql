-- Create notes table (for organization/category notes, task notes, etc.)
CREATE TABLE IF NOT EXISTS "notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT,
  "taskId" TEXT,
  "category" TEXT,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "notes_eventId_idx" ON "notes"("eventId");
CREATE INDEX IF NOT EXISTS "notes_taskId_idx" ON "notes"("taskId");
CREATE INDEX IF NOT EXISTS "notes_category_idx" ON "notes"("category");
CREATE INDEX IF NOT EXISTS "notes_updatedAt_idx" ON "notes"("updatedAt");

