-- Extend notes with responsible/participants/call metadata
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "responsibleUserId" TEXT;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "participantsUserIds" TEXT; -- JSON array of user ids
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "calledWithUserId" TEXT;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "calledWithText" TEXT;

CREATE INDEX IF NOT EXISTS "notes_responsibleUserId_idx" ON "notes"("responsibleUserId");
CREATE INDEX IF NOT EXISTS "notes_calledWithUserId_idx" ON "notes"("calledWithUserId");

