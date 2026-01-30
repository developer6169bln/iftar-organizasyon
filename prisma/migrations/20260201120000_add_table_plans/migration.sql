-- CreateTable
CREATE TABLE "table_plans" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "floorPlanUrl" TEXT,
    "planData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_plans_eventId_key" ON "table_plans"("eventId");

-- AddForeignKey
ALTER TABLE "table_plans" ADD CONSTRAINT "table_plans_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
