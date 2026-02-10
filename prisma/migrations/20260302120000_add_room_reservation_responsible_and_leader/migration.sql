-- AlterTable: Verantwortlicher Hauptnutzer + Leiter der Veranstaltung
ALTER TABLE "room_reservations" ADD COLUMN IF NOT EXISTS "responsibleUserId" TEXT;
ALTER TABLE "room_reservations" ADD COLUMN IF NOT EXISTS "eventLeaderId" TEXT;

ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_eventLeaderId_fkey" FOREIGN KEY ("eventLeaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
