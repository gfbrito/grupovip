import { prisma } from '../config/database';
import { privateMessagingService } from './private-messaging.service';

let isProcessing = false;

/**
 * Worker para processar mensagens privadas agendadas
 * Verifica mensagens pendentes a cada 1 minuto
 */
async function processScheduledMessages() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        // Buscar mensagens agendadas que já passaram do horário
        const messages = await prisma.privateMessage.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: { lte: new Date() },
            },
            take: 5, // Processar em lotes pequenos
        });

        if (messages.length > 0) {
            console.log(`[PrivateMessageWorker] Encontradas ${messages.length} mensagens agendadas.`);
        }

        for (const message of messages) {
            console.log(`[PrivateMessageWorker] Iniciando envio da mensagem ${message.id} (${message.title})`);

            // O serviço já trata a atualização de status para SENDING e o envio
            await privateMessagingService.sendToLeads(message.id, message.launchId);
        }
    } catch (error) {
        console.error('[PrivateMessageWorker] Erro ao processar mensagens agendadas:', error);
    } finally {
        isProcessing = false;
    }
}

/**
 * Inicia o worker de mensagens privadas
 */
export function startPrivateMessageWorker() {
    console.log('[PrivateMessageWorker] Iniciado (intervalo: 60s)');

    // Processar a cada 60 segundos
    setInterval(processScheduledMessages, 60000);

    // Primeira verificação após 10 segundos
    setTimeout(processScheduledMessages, 10000);
}
