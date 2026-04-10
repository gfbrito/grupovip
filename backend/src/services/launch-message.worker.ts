import { prisma } from '../config/database';
import { ApiNotConfiguredError } from './evolution.client';
import { whatsappProvider } from './whatsapp-provider.service';
import { replaceVariables, randomDelay } from './message.service';
import { deleteLocalMedia } from '../utils/file';

let isProcessing = false;

/**
 * Worker para enviar mensagens agendadas dos lançamentos
 * Processa mensagens pendentes a cada 5 segundos
 */
async function processMessages() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        // Buscar mensagens agendadas que já passaram do horário
        const messages = await prisma.launchMessage.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: { lte: new Date() },
            },
            include: { launch: { include: { groups: true } } },
            take: 1, // Processar uma por vez
        });

        for (const message of messages) {
            console.log(`[LaunchMessageWorker] Enviando mensagem para ${message.launch.name}`);

            // Marcar como enviando
            await prisma.launchMessage.update({
                where: { id: message.id },
                data: { status: 'SENDING' },
            });

            try {
                // Determinar grupos alvo
                let targetGroups = message.launch.groups.filter(g => g.isReceiving);
                if (!message.applyToAll && message.groupIds) {
                    const groupIds = JSON.parse(message.groupIds) as number[];
                    targetGroups = targetGroups.filter((g) => groupIds.includes(g.id));
                }

                let successCount = 0;
                let failCount = 0;

                // Enviar para cada grupo
                for (const group of targetGroups) {
                    try {
                        // Substituir variáveis
                        const finalContent = replaceVariables(message.content, group.name);

                        // Enviar mensagem
                        if (message.type === 'TEXT') {
                            await whatsappProvider.sendMessage(group.remoteJid, finalContent);
                        } else {
                            await whatsappProvider.sendMediaMessage(
                                group.remoteJid,
                                message.type.toLowerCase() as 'image' | 'video' | 'document' | 'audio',
                                message.mediaUrl!,
                                finalContent
                            );
                        }

                        // Registrar sucesso
                        await prisma.launchMessageLog.create({
                            data: {
                                messageId: message.id,
                                groupName: group.name,
                                groupJid: group.remoteJid,
                                status: 'SENT',
                            },
                        });

                        successCount++;

                        // Delay aleatório entre grupos
                        await randomDelay(message.delayMin, message.delayMax);

                    } catch (err: any) {
                        console.error(`[LaunchMessageWorker] Erro no grupo ${group.name}:`, err.message);

                        // Registrar falha
                        await prisma.launchMessageLog.create({
                            data: {
                                messageId: message.id,
                                groupName: group.name,
                                groupJid: group.remoteJid,
                                status: 'FAILED',
                                error: err.message,
                            },
                        });

                        failCount++;

                        // Continuar para próximo grupo
                    }
                }

                // Determinar status final
                const finalStatus = failCount === targetGroups.length ? 'FAILED' : 'COMPLETED';

                await prisma.launchMessage.update({
                    where: { id: message.id },
                    data: {
                        status: finalStatus,
                        sentAt: new Date(),
                    },
                });

                // Deletar mídia local após terminar envios (se existir)
                deleteLocalMedia(message.mediaUrl);

                console.log(`[LaunchMessageWorker] ✓ Mensagem enviada: ${successCount} sucesso, ${failCount} falhas`);

                // Disparar webhooks
                await triggerMessageWebhooks(message.launch.id, successCount, failCount, message);

            } catch (error: any) {
                console.error(`[LaunchMessageWorker] ✗ Erro geral:`, error.message);

                await prisma.launchMessage.update({
                    where: { id: message.id },
                    data: { status: 'FAILED' },
                });
                
                // Se der erro fatal, tentar deletar a mídia para não ocupar o servidor à toa
                deleteLocalMedia(message.mediaUrl);
            }
        }
    } catch (error) {
        if (!(error instanceof ApiNotConfiguredError)) {
            console.error('[LaunchMessageWorker] Erro:', error);
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Dispara webhooks de mensagem enviada/falha
 */
async function triggerMessageWebhooks(
    launchId: number,
    successCount: number,
    failCount: number,
    message: any
) {
    const webhooks = await prisma.launchWebhook.findMany({
        where: { launchId, isActive: true },
    });

    const launch = await prisma.launch.findUnique({ where: { id: launchId } });

    for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events) as string[];

        // Verificar se deve disparar
        const shouldSendSuccess = events.includes('message.sent') && successCount > 0;
        const shouldSendFail = events.includes('message.failed') && failCount > 0;

        if (!shouldSendSuccess && !shouldSendFail) continue;

        const payload = {
            event: failCount > 0 && successCount === 0 ? 'message.failed' : 'message.sent',
            timestamp: new Date().toISOString(),
            launch: {
                id: launchId,
                name: launch?.name,
                slug: launch?.slug,
            },
            data: {
                messageId: message.id,
                type: message.type,
                successCount,
                failCount,
                totalGroups: successCount + failCount,
            },
        };

        try {
            const axios = (await import('axios')).default;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (webhook.headers) Object.assign(headers, JSON.parse(webhook.headers));

            const response = await axios.post(webhook.url, payload, { headers, timeout: 10000 });

            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event: payload.event,
                    payload: JSON.stringify(payload),
                    statusCode: response.status,
                    success: true,
                },
            });
        } catch (error: any) {
            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event: payload.event,
                    payload: JSON.stringify(payload),
                    statusCode: error.response?.status || 0,
                    response: error.message,
                    success: false,
                },
            });
        }
    }
}

/**
 * Inicia o worker
 */
export function startLaunchMessageWorker() {
    console.log('[LaunchMessageWorker] Iniciado (intervalo: 5s)');

    // Processar a cada 5 segundos
    setInterval(processMessages, 5000);

    // Primeira execução após 3 segundos
    setTimeout(processMessages, 3000);
}
