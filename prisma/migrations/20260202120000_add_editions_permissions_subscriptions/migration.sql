-- CreateTable: Editionen (Free, Silver, Gold)
CREATE TABLE "editions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualPriceCents" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "editions_code_key" ON "editions"("code");

-- CreateTable: EditionCategory
CREATE TABLE "edition_categories" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edition_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "edition_categories_editionId_categoryId_key" ON "edition_categories"("editionId", "categoryId");

-- CreateTable: EditionPage
CREATE TABLE "edition_pages" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edition_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "edition_pages_editionId_pageId_key" ON "edition_pages"("editionId", "pageId");

-- CreateTable: UserCategoryPermission
CREATE TABLE "user_category_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_category_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_category_permissions_userId_categoryId_key" ON "user_category_permissions"("userId", "categoryId");

-- CreateTable: UserPagePermission
CREATE TABLE "user_page_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_page_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_page_permissions_userId_pageId_key" ON "user_page_permissions"("userId", "pageId");

-- CreateTable: Subscription
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: users – editionId, editionExpiresAt
ALTER TABLE "users" ADD COLUMN "editionId" TEXT;
ALTER TABLE "users" ADD COLUMN "editionExpiresAt" TIMESTAMP(3);

-- AlterTable: tasks – completedBy
ALTER TABLE "tasks" ADD COLUMN "completedBy" TEXT;

-- AddForeignKey: editions -> users (via editionId)
ALTER TABLE "users" ADD CONSTRAINT "users_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: tasks completedBy
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: edition_categories
ALTER TABLE "edition_categories" ADD CONSTRAINT "edition_categories_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: edition_pages
ALTER TABLE "edition_pages" ADD CONSTRAINT "edition_pages_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_category_permissions
ALTER TABLE "user_category_permissions" ADD CONSTRAINT "user_category_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_page_permissions
ALTER TABLE "user_page_permissions" ADD CONSTRAINT "user_page_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: subscriptions
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
