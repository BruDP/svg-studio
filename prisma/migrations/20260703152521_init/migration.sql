-- CreateTable
CREATE TABLE "FeedMeta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceHash" TEXT NOT NULL,
    "downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Product" (
    "sku" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Extraction" (
    "sku" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sku", "inputHash")
);

-- CreateTable
CREATE TABLE "Icon" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "svg" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scene" (
    "sku" TEXT NOT NULL PRIMARY KEY,
    "sceneJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
