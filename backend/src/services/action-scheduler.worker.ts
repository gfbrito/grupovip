import { prisma } from '../config/database';
import { evolutionClient, ApiNotConfiguredError } from './evolution.client';

let isProcessing = false;

/**
 * Worker para executar ações agendadas nos grupos
 * Processa ações pendentes a cada 30 segundos
 */
async function processActions() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        // Buscar ações agendadas que já passaram do horário
        const actions = await prisma.launchAction.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: { lte: new Date() },
            },
            include: { launch: { include: { groups: true } } },
            take: 5,
        });

        for (const action of actions) {
            console.log(`[ActionScheduler] Executando ação ${action.type} para ${action.launch.name}`);

            // Marcar como executando
            await prisma.launchAction.update({
                where: { id: action.id },
                data: { status: 'RUNNING' },
            });

            try {
                // Determinar grupos alvo
                let targetGroups = action.launch.groups;
                if (!action.applyToAll && action.groupIds) {
                    const groupIds = JSON.parse(action.groupIds) as number[];
                    targetGroups = targetGroups.filter((g) => groupIds.includes(g.id));
                }

                const config = JSON.parse(action.config || '{}');

                // Executar ação em cada grupo
                for (const group of targetGroups) {
                    try {
                        await executeActionOnGroup(action.type, group.remoteJid, config, action.launch.name);
                    } catch (err: any) {
                        console.error(`[ActionScheduler] Erro no grupo ${group.name}:`, err.message);
                    }
                }

                // Marcar como concluída
                await prisma.launchAction.update({
                    where: { id: action.id },
                    data: {
                        status: 'COMPLETED',
                        executedAt: new Date(),
                    },
                });

                console.log(`[ActionScheduler] ✓ Ação ${action.type} concluída`);

            } catch (error: any) {
                console.error(`[ActionScheduler] ✗ Erro na ação:`, error.message);

                await prisma.launchAction.update({
                    where: { id: action.id },
                    data: {
                        status: 'FAILED',
                        executedAt: new Date(),
                        error: error.message,
                    },
                });
            }
        }
    } catch (error) {
        if (!(error instanceof ApiNotConfiguredError)) {
            console.error('[ActionScheduler] Erro geral:', error);
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Executa uma ação específica em um grupo
 */
async function executeActionOnGroup(
    type: string,
    groupJid: string,
    config: any,
    launchName: string
) {
    switch (type) {
        case 'CHANGE_PHOTO':
            if (config.imageUrl) {
                await evolutionClient.updateGroupPhoto(groupJid, config.imageUrl);
            }
            break;

        case 'CHANGE_NAME':
            if (config.name) {
                // Substituir variáveis
                const finalName = config.name
                    .replace(/{nome_lancamento}/gi, launchName)
                    .replace(/{nome}/gi, launchName)
                    .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'))
                    .replace(/{hora}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

                await evolutionClient.updateGroupSettings(groupJid, { name: finalName });
            }
            break;

        case 'CHANGE_DESCRIPTION':
            if (config.description !== undefined) {
                const finalDesc = config.description
                    .replace(/{nome_lancamento}/gi, launchName)
                    .replace(/{nome}/gi, launchName)
                    .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'))
                    .replace(/{hora}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

                await evolutionClient.updateGroupSettings(groupJid, { description: finalDesc });
            }
            break;

        case 'LOCK_MESSAGES':
            await evolutionClient.updateGroupSettings(groupJid, { messagesAdminsOnly: true });
            break;

        case 'UNLOCK_MESSAGES':
            await evolutionClient.updateGroupSettings(groupJid, { messagesAdminsOnly: false });
            break;

        default:
            console.log(`[ActionScheduler] Tipo de ação desconhecido: ${type}`);
    }
}

/**
 * Inicia o worker
 */
export function startActionSchedulerWorker() {
    console.log('[ActionScheduler] Iniciado (intervalo: 30s)');

    // Processar a cada 30 segundos
    setInterval(processActions, 30000);

    // Primeira execução após 5 segundos
    setTimeout(processActions, 5000);
}
