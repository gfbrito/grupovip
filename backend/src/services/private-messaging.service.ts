import { prisma } from '../config/database';
import { whatsappProvider } from './whatsapp-provider.service';

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class PrivateMessagingService {

    /**
     * Envia uma mensagem privada para todos os leads ativos de um lançamento
     */
    async sendToLeads(messageId: number, launchId: number) {
        try {
            const message = await prisma.privateMessage.findUnique({
                where: { id: messageId },
            });

            if (!message) return;

            // Se mensagem já foi concluída, ignorar
            if (message.status === 'COMPLETED' || message.status === 'FAILED') {
                return;
            }

            // Atualizar status para SENDING se ainda não estiver
            if (message.status !== 'SENDING') {
                await prisma.privateMessage.update({
                    where: { id: messageId },
                    data: { status: 'SENDING' },
                });
            }

            // Buscar leads ativos
            const leads = await prisma.launchLead.findMany({
                where: {
                    launchId,
                    isBlocked: false,
                    groups: { some: { isActive: true } },
                },
                select: { id: true, phone: true, name: true },
            });

            console.log(`[PrivateMessageService] Enviando mensagem ${messageId} para ${leads.length} leads...`);

            let successCount = message.successCount || 0;
            let failedCount = message.failedCount || 0;
            let currentBatch = 0;

            for (const lead of leads) {
                // Verificar se já enviou para este lead (caso de retomada)
                const alreadySent = await prisma.privateMessageLog.findFirst({
                    where: {
                        messageId,
                        phone: lead.phone,
                        status: 'SENT'
                    }
                });

                if (alreadySent) continue;

                try {
                    const phoneJid = `${lead.phone}@s.whatsapp.net`;

                    if (message.mediaUrl) {
                        // TODO: Implementar envio de mídia se suportado pelo provider
                        await whatsappProvider.sendMessage(phoneJid, message.content);
                    } else {
                        await whatsappProvider.sendMessage(phoneJid, message.content);
                    }

                    await prisma.privateMessageLog.create({
                        data: {
                            messageId,
                            phone: lead.phone,
                            leadName: lead.name,
                            status: 'SENT',
                        },
                    });

                    successCount++;
                    currentBatch++;
                    console.log(`[PrivateMessageService] ✓ Enviado para ${lead.phone}`);

                    // Delay aleatório entre min e max
                    const delayTime = Math.floor(
                        Math.random() * (message.delayMax - message.delayMin) + message.delayMin
                    );

                    // Delay maior a cada 10 envios? Opcional
                    await delay(delayTime);

                } catch (error: any) {
                    failedCount++;
                    await prisma.privateMessageLog.create({
                        data: {
                            messageId,
                            phone: lead.phone,
                            leadName: lead.name,
                            status: 'FAILED',
                            error: error.message || 'Erro desconhecido',
                        },
                    });
                    console.error(`[PrivateMessageService] ✗ Falha para ${lead.phone}:`, error.message);
                }

                // Atualizar progresso parcial a cada 5 leads
                if (currentBatch % 5 === 0) {
                    await prisma.privateMessage.update({
                        where: { id: messageId },
                        data: {
                            successCount,
                            failedCount
                        },
                    });
                }
            }

            // Atualizar mensagem com status final
            await prisma.privateMessage.update({
                where: { id: messageId },
                data: {
                    status: (failedCount > 0 && successCount === 0) ? 'FAILED' : 'COMPLETED',
                    sentAt: new Date(),
                    successCount,
                    failedCount,
                },
            });

            console.log(`[PrivateMessageService] Concluído: ${successCount} sucesso, ${failedCount} falhas`);
        } catch (error) {
            console.error('[PrivateMessageService] Erro no envio:', error);
            await prisma.privateMessage.update({
                where: { id: messageId },
                data: { status: 'FAILED' },
            });
        }
    }
}

export const privateMessagingService = new PrivateMessagingService();
