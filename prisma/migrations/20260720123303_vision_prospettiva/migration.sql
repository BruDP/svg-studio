-- CreateTable
CREATE TABLE "VisionProspettiva" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "direzione" TEXT NOT NULL,
    "angoloDeg" REAL NOT NULL,
    "verso" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
