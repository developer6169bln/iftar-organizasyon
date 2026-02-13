-- AlterTable: Einladung per E-Mail gesendet – Vermerk für Anmeldungsliste
ALTER TABLE "event_registrations" ADD COLUMN "invitationSentAt" TIMESTAMP(3);
