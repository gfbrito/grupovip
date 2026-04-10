/*
  Warnings:

  - You are about to drop the column `apiKey` on the `LaunchAIConfig` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `LaunchAIConfig` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `LaunchAIConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LaunchAIConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "systemPrompt" TEXT,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchAIConfig_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LaunchAIConfig" ("autoReply", "id", "isEnabled", "launchId", "systemPrompt") SELECT "autoReply", "id", "isEnabled", "launchId", "systemPrompt" FROM "LaunchAIConfig";
DROP TABLE "LaunchAIConfig";
ALTER TABLE "new_LaunchAIConfig" RENAME TO "LaunchAIConfig";
CREATE UNIQUE INDEX "LaunchAIConfig_launchId_key" ON "LaunchAIConfig"("launchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
