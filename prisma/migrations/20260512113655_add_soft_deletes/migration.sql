-- AlterTable
ALTER TABLE "academic_sessions" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "grades" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "parents" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "terms" ADD COLUMN "deletedAt" DATETIME;
