-- Mailjet-Spalten in email_configs anlegen (falls Migration 20260130140000 nicht lief)
-- Railway: Postgres → Data / Query → SQL einfügen und ausführen
-- Bei "column already exists" beim 2. Mal: ignorieren

ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "mailjetApiKey" TEXT;
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "mailjetApiSecret" TEXT;
