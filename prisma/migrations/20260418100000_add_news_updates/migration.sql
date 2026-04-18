-- CreateTable
CREATE TABLE "NewsUpdate" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "href" TEXT,
    "gradient" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsUpdate_isActive_audience_sortOrder_idx" ON "NewsUpdate"("isActive", "audience", "sortOrder");
