-- Mailgun-Spalten in email_configs ergänzen (falls Migration 20260128140000 nicht lief)
-- Railway: Postgres-Service → Data / Query → alles markieren, ausführen
-- Fehler "column already exists" beim 2. Mal: ignorieren

ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "mailgunDomain" TEXT;
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "mailgunApiKey" TEXT;
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "mailgunRegion" TEXT;
