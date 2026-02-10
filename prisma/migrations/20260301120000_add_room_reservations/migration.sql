-- CreateTable: Räume (vom Admin verwaltet)
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Raum-Reservierungen (manuell oder aus Projekt)
CREATE TABLE "room_reservations" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "projectId" TEXT,
    "eventId" TEXT,
    "reservedByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "room_reservations_roomId_idx" ON "room_reservations"("roomId");
CREATE INDEX "room_reservations_startAt_idx" ON "room_reservations"("startAt");
CREATE INDEX "room_reservations_projectId_idx" ON "room_reservations"("projectId");

ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "room_reservations" ADD CONSTRAINT "room_reservations_reservedByUserId_fkey" FOREIGN KEY ("reservedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
