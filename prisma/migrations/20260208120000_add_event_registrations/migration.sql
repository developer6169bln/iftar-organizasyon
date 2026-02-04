-- CreateTable: Öffentliche Registrierung von Interessenten (z. B. UID Iftar)
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "district" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "participating" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_registrations_eventSlug_idx" ON "event_registrations"("eventSlug");
CREATE INDEX "event_registrations_createdAt_idx" ON "event_registrations"("createdAt");
