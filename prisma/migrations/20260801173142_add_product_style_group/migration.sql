-- AlterTable
ALTER TABLE "products" ADD COLUMN     "styleGroup" TEXT;

-- CreateIndex
CREATE INDEX "products_styleGroup_idx" ON "products"("styleGroup");
