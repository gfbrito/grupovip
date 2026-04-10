-- CreateTable
CREATE TABLE "LeadScoreEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LeadScoreEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadScoreEvent_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LaunchLead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstClickAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreUpdatedAt" DATETIME,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchLead_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LaunchLead" ("firstClickAt", "id", "isBlocked", "lastSeenAt", "launchId", "name", "phone") SELECT "firstClickAt", "id", "isBlocked", "lastSeenAt", "launchId", "name", "phone" FROM "LaunchLead";
DROP TABLE "LaunchLead";
ALTER TABLE "new_LaunchLead" RENAME TO "LaunchLead";
CREATE UNIQUE INDEX "LaunchLead_launchId_phone_key" ON "LaunchLead"("launchId", "phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
