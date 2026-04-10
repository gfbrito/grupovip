import { prisma } from '../config/database';
import { evolutionClient, ApiNotConfiguredError } from './evolution.client';

let isProcessing = false;

/**
 * Worker para criar grupos da fila
 * Processa um item por vez a cada 10 segundos
 * Cada grupo é criado com 2 minutos de intervalo (controlado via scheduledAt)
 */
async function processQueue() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        // Buscar próximo item pendente que já passou do horário agendado
        const item = await prisma.groupCreationQueue.findFirst({
            where: {
                status: 'PENDING',
                scheduledAt: { lte: new Date() },
            },
            orderBy: { scheduledAt: 'asc' },
            include: { launch: true },
        });

        if (!item) {
            return;
        }

        console.log(`[GroupCreationWorker] Processando: ${item.name} (Lançamento: ${item.launch.name})`);

        // Marcar como criando
        await prisma.groupCreationQueue.update({
            where: { id: item.id },
            data: { status: 'CREATING' },
        });

        try {
            // Criar grupo via Evolution
            // API exige pelo menos um participante e descrição não vazia
            const participants = ['5564992933763']; // Número provisório do admin/usuário
            const description = item.description || '.'; // API rejeita string vazia

            const result = await evolutionClient.createGroup(
                item.name,
                description,
                participants
            );

            // Salvar grupo no lançamento
            const launchGroup = await prisma.launchGroup.create({
                data: {
                    launchId: item.launchId,
                    remoteJid: result.id,
                    name: item.name,
                    number: item.number,
                    inviteLink: result.inviteLink,
                    origin: 'CREATED',
                },
            });

            // Aplicar configurações adicionais se necessário
            if (item.lockMessages || item.adminOnly) {
                try {
                    await evolutionClient.updateGroupSettings(result.id, {
                        messagesAdminsOnly: item.lockMessages || item.adminOnly,
                    });
                } catch (err) {
                    console.log(`[GroupCreationWorker] Aviso: Não foi possível configurar grupo`);
                }
            }

            // Marcar como concluído
            await prisma.groupCreationQueue.update({
                where: { id: item.id },
                data: {
                    status: 'COMPLETED',
                    processedAt: new Date(),
                    resultGroupJid: result.id,
                },
            });

            console.log(`[GroupCreationWorker] ✓ Grupo criado: ${item.name} (${result.id})`);

            // Disparar webhook de grupo criado
            await triggerGroupCreatedWebhook(item.launchId, launchGroup);

        } catch (error: any) {
            const errorDetail = error.response?.data
                ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data))
                : error.message;

            console.error(`[GroupCreationWorker] ✗ Erro ao criar grupo:`, errorDetail);

            await prisma.groupCreationQueue.update({
                where: { id: item.id },
                data: {
                    status: 'FAILED',
                    processedAt: new Date(),
                    error: errorDetail || 'Erro desconhecido',
                },
            });
        }
    } catch (error) {
        if (!(error instanceof ApiNotConfiguredError)) {
            console.error('[GroupCreationWorker] Erro geral:', error);
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Dispara webhook de grupo criado
 */
async function triggerGroupCreatedWebhook(launchId: number, group: any) {
    const webhooks = await prisma.launchWebhook.findMany({
        where: { launchId, isActive: true },
    });

    const launch = await prisma.launch.findUnique({ where: { id: launchId } });

    for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events) as string[];
        if (!events.includes('group.created')) continue;

        const payload = {
            event: 'group.created',
            timestamp: new Date().toISOString(),
            launch: {
                id: launchId,
                name: launch?.name,
                slug: launch?.slug,
            },
            data: {
                groupId: group.id,
                groupName: group.name,
                number: group.number,
                inviteLink: group.inviteLink,
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
                    event: 'group.created',
                    payload: JSON.stringify(payload),
                    statusCode: response.status,
                    success: true,
                },
            });
        } catch (error: any) {
            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event: 'group.created',
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
export function startGroupCreationWorker() {
    console.log('[GroupCreationWorker] Iniciado (intervalo: 10s)');

    // Processar a cada 10 segundos
    setInterval(processQueue, 10000);

    // Primeira execução imediata
    processQueue();
}
