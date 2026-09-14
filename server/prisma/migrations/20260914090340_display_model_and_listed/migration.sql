-- AlterTable
ALTER TABLE "product_variations" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "display_model_number" TEXT;
