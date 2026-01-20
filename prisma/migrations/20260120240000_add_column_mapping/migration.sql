-- Add column mapping field to events table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "googleSheetsColumnMapping" TEXT;
