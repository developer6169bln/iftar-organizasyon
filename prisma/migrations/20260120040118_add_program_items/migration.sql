-- CreateTable
CREATE TABLE "program_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "speakerName" TEXT,
    "topic" TEXT,
    "duration" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "order" INTEGER NOT NULL,
    "musicType" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "program_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
