-- Add optional note type for categorizing notes (meeting/call/appointment)
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "type" TEXT;

CREATE INDEX IF NOT EXISTS "notes_type_idx" ON "notes"("type");

