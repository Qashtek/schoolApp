/*
  Warnings:

  - Added the required column `admissionNumber` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolId` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "grade" TEXT,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "students_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_students" ("classId", "createdAt", "grade", "id", "parentId", "updatedAt", "userId") SELECT "classId", "createdAt", "grade", "id", "parentId", "updatedAt", "userId" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");
CREATE UNIQUE INDEX "students_schoolId_admissionNumber_key" ON "students"("schoolId", "admissionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
