-- AlterTable
ALTER TABLE "product_variations" ADD COLUMN     "backorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "row_display_model" TEXT,
ADD COLUMN     "row_install_type" TEXT,
ADD COLUMN     "row_name" TEXT;

-- CreateTable
CREATE TABLE "image_files" (
    "file_name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_files_pkey" PRIMARY KEY ("file_name")
);
