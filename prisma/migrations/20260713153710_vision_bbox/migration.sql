-- CreateTable
CREATE TABLE "VisionBBox" (
    "imageHash" TEXT NOT NULL PRIMARY KEY,
    "trovato" BOOLEAN NOT NULL,
    "left" INTEGER,
    "top" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
