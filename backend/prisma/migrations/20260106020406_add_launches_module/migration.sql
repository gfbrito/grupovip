-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "secretToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "launchId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "memberLimit" INTEGER NOT NULL DEFAULT 256,
    "autoCreateGroup" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateAt" INTEGER NOT NULL DEFAULT 90,
    "singleGroupOnly" BOOLEAN NOT NULL DEFAULT false,
    "metaPixelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metaPixelId" TEXT,
    "metaPixelEvents" TEXT,
    "gtmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gtmId" TEXT,
    "linkType" TEXT NOT NULL DEFAULT 'NORMAL',
    "fullPageMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Launch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "remoteJid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isReceiving" BOOLEAN NOT NULL DEFAULT true,
    "origin" TEXT NOT NULL DEFAULT 'CREATED',
    "originalName" TEXT,
    "inviteLink" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchGroup_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupCreationQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "error" TEXT,
    "resultGroupJid" TEXT,
    "lockMessages" BOOLEAN NOT NULL DEFAULT false,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "GroupCreationQueue_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchLead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstClickAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchLead_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchLeadGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "leadId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    CONSTRAINT "LaunchLeadGroup_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaunchLeadGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LaunchGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchClick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,
    "leadId" INTEGER,
    CONSTRAINT "LaunchClick_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "executedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "groupIds" TEXT,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchAction_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "groupIds" TEXT,
    "delayMin" INTEGER NOT NULL DEFAULT 800,
    "delayMax" INTEGER NOT NULL DEFAULT 2000,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchMessage_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchMessageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupName" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" INTEGER NOT NULL,
    CONSTRAINT "LaunchMessageLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "LaunchMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchWebhook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "headers" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "launchId" INTEGER NOT NULL,
    CONSTRAINT "LaunchWebhook_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookOutLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhookId" INTEGER NOT NULL,
    CONSTRAINT "WebhookOutLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "LaunchWebhook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Launch_slug_key" ON "Launch"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchGroup_remoteJid_key" ON "LaunchGroup"("remoteJid");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchGroup_launchId_number_key" ON "LaunchGroup"("launchId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchLead_launchId_phone_key" ON "LaunchLead"("launchId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchLeadGroup_leadId_groupId_key" ON "LaunchLeadGroup"("leadId", "groupId");
