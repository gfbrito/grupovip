import { prisma } from '../config/database';
import { ApiNotConfiguredError } from './evolution.client';
import { whatsappProvider } from './whatsapp-provider.service';
import { replaceVariables, randomDelay } from './message.service';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Processa jobs pendentes na fila
 */
async function processQueue(): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    try {
        // Buscar jobs pendentes que devem ser processados
        const jobs = await prisma.campaignJob.findMany({
            where: {
                status: 'PENDING',
                processAt: { lte: new Date() },
                campaign: {
                    status: 'RUNNING',
                },
            },
            take: 5,
            include: {
                campaign: true,
                group: true,
            },
            orderBy: { processAt: 'asc' },
        });

        if (jobs.length === 0) {
            isRunning = false;
            return;
        }

        console.log(`[Queue] Processando ${jobs.length} jobs...`);

        for (const job of jobs) {
            // Marcar como processando
            await prisma.campaignJob.update({
                where: { id: job.id },
                data: { status: 'PROCESSING', attempts: job.attempts + 1 },
            });

            try {
                // Substituir variáveis na mensagem
                const message = replaceVariables(job.campaign.message, job.group);

                // Enviar mensagem
                await whatsappProvider.sendMessage(job.group.remoteJid, message);

                // Marcar como concluído
                await prisma.campaignJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'COMPLETED',
                        processedAt: new Date(),
                    },
                });

                // Log de sucesso
                await prisma.messageLog.create({
                    data: {
                        type: 'SUCCESS',
                        message: `Mensagem enviada para "${job.group.nickname || job.group.name}"`,
                        campaignId: job.campaignId,
                    },
                });

                console.log(`[Queue] ✓ Enviado para ${job.group.name}`);
            } catch (error) {
                console.error(`[Queue] ✗ Erro ao enviar para ${job.group.name}:`, error);

                const errorMessage = error instanceof Error ? error.message : String(error);

                // Verificar se deve tentar novamente (máximo 3 tentativas)
                if (job.attempts + 1 >= 3) {
                    await prisma.campaignJob.update({
                        where: { id: job.id },
                        data: {
                            status: 'FAILED',
                            lastError: errorMessage,
                            processedAt: new Date(),
                        },
                    });

                    await prisma.messageLog.create({
                        data: {
                            type: 'ERROR',
                            message: `Falha ao enviar para "${job.group.name}": ${errorMessage}`,
                            campaignId: job.campaignId,
                        },
                    });
                } else {
                    // Reagendar para tentar novamente em 30 segundos
                    await prisma.campaignJob.update({
                        where: { id: job.id },
                        data: {
                            status: 'PENDING',
                            lastError: errorMessage,
                            processAt: new Date(Date.now() + 30000),
                        },
                    });
                }
            }

            // Delay aleatório entre mensagens (800-1800ms)
            await randomDelay(800, 1800);
        }

        // Verificar se a campanha foi concluída
        await checkCampaignCompletion();
    } catch (error) {
        if (error instanceof ApiNotConfiguredError) {
            console.log('[Queue] API não configurada, aguardando...');
        } else {
            console.error('[Queue] Erro ao processar fila:', error);
        }
    } finally {
        isRunning = false;
    }
}

/**
 * Verifica se campanhas em execução foram concluídas
 */
async function checkCampaignCompletion(): Promise<void> {
    const runningCampaigns = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        include: {
            _count: {
                select: { jobs: true },
            },
        },
    });

    for (const campaign of runningCampaigns) {
        const pendingJobs = await prisma.campaignJob.count({
            where: {
                campaignId: campaign.id,
                status: { in: ['PENDING', 'PROCESSING'] },
            },
        });

        if (pendingJobs === 0) {
            // Verificar se houve falhas
            const failedJobs = await prisma.campaignJob.count({
                where: {
                    campaignId: campaign.id,
                    status: 'FAILED',
                },
            });

            const newStatus: string = failedJobs > 0 ? 'FAILED' : 'COMPLETED';

            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: newStatus },
            });

            await prisma.messageLog.create({
                data: {
                    type: failedJobs > 0 ? 'WARNING' : 'SUCCESS',
                    message: `Campanha "${campaign.name}" ${newStatus === 'COMPLETED' ? 'concluída' : 'finalizada com falhas'}`,
                    campaignId: campaign.id,
                },
            });

            console.log(`[Queue] Campanha "${campaign.name}" ${newStatus}`);
        }
    }
}

/**
 * Inicia o worker de processamento de fila
 */
export function startQueueWorker(): void {
    if (intervalId) {
        console.log('[Queue] Worker já está rodando');
        return;
    }

    console.log('[Queue] Iniciando worker...');

    // Processar a cada 5 segundos
    intervalId = setInterval(processQueue, 5000);

    // Processar imediatamente
    processQueue();
}

/**
 * Para o worker
 */
export function stopQueueWorker(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[Queue] Worker parado');
    }
}

/**
 * Retorna status do worker
 */
export function isWorkerRunning(): boolean {
    return intervalId !== null;
}
