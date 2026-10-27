-- CreateTable
CREATE TABLE "ledger_rows" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sheet" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "sku_code" TEXT,
    "listed" BOOLEAN NOT NULL,
    "cells" JSONB NOT NULL,

    CONSTRAINT "ledger_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rakuten_skus" (
    "id" SERIAL NOT NULL,
    "values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rakuten_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rakuten_images" (
    "id" SERIAL NOT NULL,
    "book" TEXT NOT NULL,
    "sort_no" INTEGER NOT NULL,
    "no" INTEGER,
    "file_name" TEXT NOT NULL,
    "folder1" TEXT,
    "folder2" TEXT,
    "renamed_name" TEXT,
    "path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rakuten_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_rows_product_id_idx" ON "ledger_rows"("product_id");

-- CreateIndex
CREATE INDEX "rakuten_images_book_sort_no_idx" ON "rakuten_images"("book", "sort_no");

-- AddForeignKey
ALTER TABLE "ledger_rows" ADD CONSTRAINT "ledger_rows_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
