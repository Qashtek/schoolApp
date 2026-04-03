-- CreateTable
CREATE TABLE "grade_bands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "minScore" REAL NOT NULL,
    "maxScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "grade_bands_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "grade_bands_schoolId_level_letter_key" ON "grade_bands"("schoolId", "level", "letter");

-- CreateIndex
CREATE INDEX "grade_bands_schoolId_level_minScore_maxScore_idx" ON "grade_bands"("schoolId", "level", "minScore", "maxScore");
