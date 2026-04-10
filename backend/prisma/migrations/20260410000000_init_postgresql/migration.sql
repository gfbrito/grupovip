-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "maxLaunches" INTEGER NOT NULL DEFAULT 1,
    "maxGroupsPerLaunch" INTEGER NOT NULL DEFAULT 3,
    "maxLeads" INTEGER NOT NULL DEFAULT 500,
    "maxWhatsAppServers" INTEGER NOT NULL DEFAULT 1,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privateMessagesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhooksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiTokensPerMonth" INTEGER NOT NULL DEFAULT 0,
    "aiCreditsPerOperation" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAICredits" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthlyQuota" INTEGER NOT NULL DEFAULT 0,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "extraCredits" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAICredits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MONTHLY',
    "refId" INTEGER,
    "refType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICreditPurchase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "packageName" TEXT NOT NULL,
    "tokensAmount" INTEGER NOT NULL,
    "priceBRL" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AICreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "evolutionUrl" TEXT,
    "evolutionKey" TEXT,
    "instanceName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" TEXT,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "paypalClientId" TEXT,
    "paypalSecret" TEXT,
    "paypalWebhookId" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "enableAI" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppServer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT,
    "instanceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastCheck" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignJob" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "campaignId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "CampaignJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" INTEGER,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "secretToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'OPENAI',
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "launchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchGroup" (
    "id" SERIAL NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isReceiving" BOOLEAN NOT NULL DEFAULT true,
    "origin" TEXT NOT NULL DEFAULT 'CREATED',
    "originalName" TEXT,
    "inviteLink" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupCreationQueue" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "resultGroupJid" TEXT,
    "lockMessages" BOOLEAN NOT NULL DEFAULT false,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "GroupCreationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchLead" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstClickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreUpdatedAt" TIMESTAMP(3),
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchLeadGroup" (
    "id" SERIAL NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "leadId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "LaunchLeadGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchClick" (
    "id" SERIAL NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,
    "leadId" INTEGER,

    CONSTRAINT "LaunchClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchAction" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "groupIds" TEXT,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchMessage" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "groupIds" TEXT,
    "delayMin" INTEGER NOT NULL DEFAULT 800,
    "delayMax" INTEGER NOT NULL DEFAULT 2000,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchMessageLog" (
    "id" SERIAL NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "LaunchMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchWebhook" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "headers" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookOutLog" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhookId" INTEGER NOT NULL,

    CONSTRAINT "WebhookOutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadMessage" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "fromPhone" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'EVOLUTION',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSuggestion" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repliedAt" TIMESTAMP(3),
    "repliedBy" INTEGER,
    "reply" TEXT,
    "launchId" INTEGER NOT NULL,
    "leadId" INTEGER,

    CONSTRAINT "LeadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchAIConfig" (
    "id" SERIAL NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "systemPrompt" TEXT,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LaunchAIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMessage" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "delayMin" INTEGER NOT NULL DEFAULT 1500,
    "delayMax" INTEGER NOT NULL DEFAULT 3000,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMessageLog" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "leadName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "PrivateMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoreEvent" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchId" INTEGER NOT NULL,

    CONSTRAINT "LeadScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserAICredits_userId_key" ON "UserAICredits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_remoteJid_key" ON "Group"("remoteJid");

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

-- CreateIndex
CREATE UNIQUE INDEX "LaunchAIConfig_launchId_key" ON "LaunchAIConfig"("launchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAICredits" ADD CONSTRAINT "UserAICredits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITransaction" ADD CONSTRAINT "AITransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAICredits"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICreditPurchase" ADD CONSTRAINT "AICreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAICredits"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchGroup" ADD CONSTRAINT "LaunchGroup_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCreationQueue" ADD CONSTRAINT "GroupCreationQueue_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchLead" ADD CONSTRAINT "LaunchLead_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchLeadGroup" ADD CONSTRAINT "LaunchLeadGroup_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchLeadGroup" ADD CONSTRAINT "LaunchLeadGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LaunchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchClick" ADD CONSTRAINT "LaunchClick_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchAction" ADD CONSTRAINT "LaunchAction_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchMessage" ADD CONSTRAINT "LaunchMessage_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchMessageLog" ADD CONSTRAINT "LaunchMessageLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "LaunchMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchWebhook" ADD CONSTRAINT "LaunchWebhook_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookOutLog" ADD CONSTRAINT "WebhookOutLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "LaunchWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchAIConfig" ADD CONSTRAINT "LaunchAIConfig_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessageLog" ADD CONSTRAINT "PrivateMessageLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PrivateMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreEvent" ADD CONSTRAINT "LeadScoreEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaunchLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreEvent" ADD CONSTRAINT "LeadScoreEvent_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

