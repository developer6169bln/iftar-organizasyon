-- Add additionalData field to store all extra columns from Google Sheets (1:1 import)
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "additionalData" TEXT;
