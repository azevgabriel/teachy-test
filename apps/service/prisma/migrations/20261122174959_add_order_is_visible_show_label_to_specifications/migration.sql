-- AlterTable
ALTER TABLE "specifications" ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "show_label" BOOLEAN NOT NULL DEFAULT true;
