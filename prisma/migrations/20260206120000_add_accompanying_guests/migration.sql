-- AlterTable
ALTER TABLE "events" ADD COLUMN "maxAccompanyingGuests" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN "accompanyingGuestsCount" INTEGER;
