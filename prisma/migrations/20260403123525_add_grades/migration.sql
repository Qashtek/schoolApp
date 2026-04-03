/*
  Warnings:

  - You are about to drop the column `date` on the `grades` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `grades` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `grades` table. All the data in the column will be lost.
  - You are about to drop the column `teacherId` on the `grades` table. All the data in the column will be lost.
  - Added the required column `schoolId` to the `grades` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectId` to the `grades` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termId` to the `grades` table without a default value. This is not possible if the table is not empty.
  - Made the column `classId` on table `grades` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_grades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "caScore" REAL,
    "examScore" REAL,
    "total" REAL,
    "grade" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grades_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grades_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grades_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grades_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_grades" ("classId", "createdAt", "id", "studentId", "updatedAt") SELECT "classId", "createdAt", "id", "studentId", "updatedAt" FROM "grades";
DROP TABLE "grades";
ALTER TABLE "new_grades" RENAME TO "grades";
CREATE UNIQUE INDEX "grades_studentId_subjectId_termId_key" ON "grades"("studentId", "subjectId", "termId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
