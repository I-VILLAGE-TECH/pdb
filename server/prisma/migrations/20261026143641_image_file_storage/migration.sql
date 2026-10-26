-- AlterTable
ALTER TABLE "image_files" ADD COLUMN     "byte_size" INTEGER,
ADD COLUMN     "source_path" TEXT,
ADD COLUMN     "storage_key" TEXT,
ADD COLUMN     "uploaded_at" TIMESTAMP(3);
