-- AlterTable
ALTER TABLE "plannings" ADD COLUMN     "recess_dates" TEXT[] DEFAULT ARRAY[]::TEXT[];
