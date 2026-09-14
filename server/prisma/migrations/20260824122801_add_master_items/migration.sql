-- CreateTable
CREATE TABLE "master_items" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 999,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_items_type_active_idx" ON "master_items"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "master_items_type_value_key" ON "master_items"("type", "value");
