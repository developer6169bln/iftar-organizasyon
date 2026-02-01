-- Mailjet-Spalten in email_configs anlegen (falls Migration 20260130140000 nicht lief)
-- Railway: Postgres-Service → Data → Query → SQL einfügen und ausführen (einmalig)
-- Falls Fehler "column already exists": Spalten sind schon da, Konfiguration erneut speichern.

ALTER TABLE "email_configs" ADD COLUMN "mailjetApiKey" TEXT;
ALTER TABLE "email_configs" ADD COLUMN "mailjetApiSecret" TEXT;
