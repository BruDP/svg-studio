-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VisionProspettiva" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "direzione" TEXT NOT NULL,
    "angoloDeg" REAL NOT NULL,
    "verso" TEXT NOT NULL,
    "origine" TEXT NOT NULL DEFAULT 'vision',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VisionProspettiva" ("angoloDeg", "createdAt", "direzione", "hash", "verso") SELECT "angoloDeg", "createdAt", "direzione", "hash", "verso" FROM "VisionProspettiva";
DROP TABLE "VisionProspettiva";
ALTER TABLE "new_VisionProspettiva" RENAME TO "VisionProspettiva";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
