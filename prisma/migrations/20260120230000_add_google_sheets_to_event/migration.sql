-- Add Google Sheets fields to events table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "googleSheetsId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "googleSheetsSheetName" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "googleSheetsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "googleSheetsLastSync" TIMESTAMP;
