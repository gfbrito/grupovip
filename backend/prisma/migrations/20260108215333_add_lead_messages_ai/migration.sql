-- CreateTable
CREATE TABLE "LeadMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "fromPhone" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'EVOLUTION',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSuggestion" TEXT,
    "aiConfidence" REAL,
    "aiCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repliedAt" DATETIME,
    "repliedBy" INTEGER,
    "reply" TEXT,
    "launchId" INTEGER NOT NULL,
    "leadId" INTEGER,
    CONSTRAINT "LeadMessage_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchAIConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'OPENAI',
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchAIConfig_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchAIConfig_launchId_key" ON "LaunchAIConfig"("launchId");
