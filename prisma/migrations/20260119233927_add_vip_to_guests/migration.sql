-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "organization" TEXT,
    "tableNumber" INTEGER,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "arrivalTime" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "guests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_guests" ("arrivalTime", "createdAt", "email", "eventId", "id", "name", "notes", "organization", "phone", "status", "tableNumber", "title", "updatedAt") SELECT "arrivalTime", "createdAt", "email", "eventId", "id", "name", "notes", "organization", "phone", "status", "tableNumber", "title", "updatedAt" FROM "guests";
DROP TABLE "guests";
ALTER TABLE "new_guests" RENAME TO "guests";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
