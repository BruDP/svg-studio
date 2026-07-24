-- CreateTable
CREATE TABLE "CostLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "operazione" TEXT NOT NULL,
    "modello" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CostLog_sku_idx" ON "CostLog"("sku");

-- CreateIndex
CREATE INDEX "CostLog_createdAt_idx" ON "CostLog"("createdAt");
