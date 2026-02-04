-- AlterTable: Check-In-Token für QR-Code am Eventtag
ALTER TABLE "guests" ADD COLUMN "checkInToken" TEXT;

CREATE UNIQUE INDEX "guests_checkInToken_key" ON "guests"("checkInToken");

-- CreateTable: Begleitpersonen pro Einladung
CREATE TABLE "accompanying_guests" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "funktion" TEXT,
    "email" TEXT,
    "checkInToken" TEXT NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accompanying_guests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accompanying_guests_checkInToken_key" ON "accompanying_guests"("checkInToken");
CREATE INDEX "accompanying_guests_invitationId_idx" ON "accompanying_guests"("invitationId");

ALTER TABLE "accompanying_guests" ADD CONSTRAINT "accompanying_guests_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
