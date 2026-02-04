-- CreateTable
CREATE TABLE "media_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "approvedForSharing" BOOLEAN NOT NULL DEFAULT false,
    "sharedInstagram" BOOLEAN NOT NULL DEFAULT false,
    "sharedFacebook" BOOLEAN NOT NULL DEFAULT false,
    "sharedOtherMedia" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_items_eventId_idx" ON "media_items"("eventId");

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
