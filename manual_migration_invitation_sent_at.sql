-- Manuelle Migration: invitationSentAt zu event_registrations
-- Einladung per E-Mail gesendet – Vermerk für Anmeldungsliste
-- Ausführen in: Supabase SQL Editor, Railway Query, psql o.ä.

ALTER TABLE "event_registrations" ADD COLUMN "invitationSentAt" TIMESTAMP(3);
