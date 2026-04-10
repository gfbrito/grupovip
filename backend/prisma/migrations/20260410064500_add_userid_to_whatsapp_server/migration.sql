-- AlterTable
ALTER TABLE "WhatsAppServer" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "WhatsAppServer" ADD CONSTRAINT "WhatsAppServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
