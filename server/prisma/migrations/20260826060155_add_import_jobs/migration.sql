-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "book_type" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "soft_deleted" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "triggered_by" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_started_at_idx" ON "import_jobs"("started_at");
