-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "called" BOOLEAN NOT NULL DEFAULT false;
