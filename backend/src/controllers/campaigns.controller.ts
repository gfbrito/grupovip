import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/campaigns
 * Lista todas as campanhas do usuário
 */
export async function listCampaigns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const campaigns = await prisma.campaign.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        jobs: true,
                    },
                },
            },
        });

        // Adicionar contagem de jobs por status
        const campaignsWithStats = await Promise.all(
            campaigns.map(async campaign => {
                const jobStats = await prisma.campaignJob.groupBy({
                    by: ['status'],
                    where: { campaignId: campaign.id },
                    _count: { status: true },
                });

                const stats = {
                    pending: 0,
                    processing: 0,
                    completed: 0,
                    failed: 0,
                };

                jobStats.forEach(stat => {
                    stats[stat.status.toLowerCase() as keyof typeof stats] = stat._count.status;
                });

                return {
                    ...campaign,
                    stats,
                };
            })
        );

        res.json({ campaigns: campaignsWithStats });
    } catch (error) {
        console.error('Erro ao listar campanhas:', error);
        res.status(500).json({ error: 'Erro ao listar campanhas' });
    }
}

/**
 * POST /api/campaigns
 * Cria uma nova campanha
 */
export async function createCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { name, message, groupIds, scheduledAt } = req.body;

        // Validações
        if (!name || !message) {
            res.status(400).json({ error: 'Nome e mensagem são obrigatórios' });
            return;
        }

        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            res.status(400).json({ error: 'Selecione pelo menos um grupo' });
            return;
        }

        // Verificar se os grupos existem e estão ativos
        const groups = await prisma.group.findMany({
            where: {
                id: { in: groupIds },
                isActive: true,
            },
        });

        if (groups.length === 0) {
            res.status(400).json({ error: 'Nenhum grupo ativo selecionado' });
            return;
        }

        // Criar campanha com jobs
        const campaign = await prisma.campaign.create({
            data: {
                name,
                message,
                status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                userId: req.user.id,
                jobs: {
                    create: groups.map(group => ({
                        groupId: group.id,
                        status: 'PENDING',
                        processAt: scheduledAt ? new Date(scheduledAt) : new Date(),
                    })),
                },
            },
            include: {
                jobs: {
                    include: {
                        group: true,
                    },
                },
            },
        });

        // Log
        await prisma.messageLog.create({
            data: {
                type: 'INFO',
                message: `Campanha "${name}" criada com ${groups.length} grupos`,
                campaignId: campaign.id,
            },
        });

        res.status(201).json({
            message: 'Campanha criada com sucesso',
            campaign,
        });
    } catch (error) {
        console.error('Erro ao criar campanha:', error);
        res.status(500).json({ error: 'Erro ao criar campanha' });
    }
}

/**
 * GET /api/campaigns/:id
 * Retorna detalhes de uma campanha com seus jobs
 */
export async function getCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { id } = req.params;

        const campaign = await prisma.campaign.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id,
            },
            include: {
                jobs: {
                    include: {
                        group: true,
                    },
                    orderBy: { id: 'asc' },
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campanha não encontrada' });
            return;
        }

        res.json({ campaign });
    } catch (error) {
        console.error('Erro ao buscar campanha:', error);
        res.status(500).json({ error: 'Erro ao buscar campanha' });
    }
}

/**
 * POST /api/campaigns/:id/start
 * Inicia uma campanha (muda status para RUNNING)
 */
export async function startCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { id } = req.params;

        const campaign = await prisma.campaign.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id,
            },
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campanha não encontrada' });
            return;
        }

        if (campaign.status === 'RUNNING') {
            res.status(400).json({ error: 'Campanha já está em execução' });
            return;
        }

        if (campaign.status === 'COMPLETED') {
            res.status(400).json({ error: 'Campanha já foi concluída' });
            return;
        }

        // Atualizar status da campanha
        await prisma.campaign.update({
            where: { id: parseInt(id) },
            data: { status: 'RUNNING' },
        });

        // Atualizar jobs pendentes para processar agora
        await prisma.campaignJob.updateMany({
            where: {
                campaignId: parseInt(id),
                status: 'PENDING',
            },
            data: {
                processAt: new Date(),
            },
        });

        // Log
        await prisma.messageLog.create({
            data: {
                type: 'INFO',
                message: `Campanha "${campaign.name}" iniciada`,
                campaignId: campaign.id,
            },
        });

        res.json({ message: 'Campanha iniciada' });
    } catch (error) {
        console.error('Erro ao iniciar campanha:', error);
        res.status(500).json({ error: 'Erro ao iniciar campanha' });
    }
}

/**
 * POST /api/campaigns/:id/pause
 * Pausa uma campanha
 */
export async function pauseCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { id } = req.params;

        const campaign = await prisma.campaign.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id,
            },
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campanha não encontrada' });
            return;
        }

        if (campaign.status !== 'RUNNING') {
            res.status(400).json({ error: 'Apenas campanhas em execução podem ser pausadas' });
            return;
        }

        await prisma.campaign.update({
            where: { id: parseInt(id) },
            data: { status: 'PAUSED' },
        });

        // Log
        await prisma.messageLog.create({
            data: {
                type: 'WARNING',
                message: `Campanha "${campaign.name}" pausada`,
                campaignId: campaign.id,
            },
        });

        res.json({ message: 'Campanha pausada' });
    } catch (error) {
        console.error('Erro ao pausar campanha:', error);
        res.status(500).json({ error: 'Erro ao pausar campanha' });
    }
}

/**
 * DELETE /api/campaigns/:id
 * Remove uma campanha
 */
export async function deleteCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const { id } = req.params;

        const campaign = await prisma.campaign.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id,
            },
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campanha não encontrada' });
            return;
        }

        if (campaign.status === 'RUNNING') {
            res.status(400).json({ error: 'Não é possível excluir uma campanha em execução' });
            return;
        }

        // Os jobs são removidos em cascata (onDelete: Cascade)
        await prisma.campaign.delete({
            where: { id: parseInt(id) },
        });

        res.json({ message: 'Campanha excluída' });
    } catch (error) {
        console.error('Erro ao excluir campanha:', error);
        res.status(500).json({ error: 'Erro ao excluir campanha' });
    }
}

/**
 * GET /api/campaigns/stats
 * Retorna estatísticas gerais de campanhas
 */
export async function getCampaignStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        // Mensagens enviadas hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sentToday = await prisma.campaignJob.count({
            where: {
                status: 'COMPLETED',
                processedAt: { gte: today },
            },
        });

        // Erros hoje
        const errorsToday = await prisma.campaignJob.count({
            where: {
                status: 'FAILED',
                processedAt: { gte: today },
            },
        });

        // Na fila
        const pending = await prisma.campaignJob.count({
            where: { status: 'PENDING' },
        });

        // Total de grupos ativos
        const activeGroups = await prisma.group.count({
            where: { isActive: true },
        });

        res.json({
            sentToday,
            errorsToday,
            pending,
            activeGroups,
            errorRate: sentToday > 0 ? ((errorsToday / (sentToday + errorsToday)) * 100).toFixed(1) : '0',
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
}

/**
 * GET /api/logs
 * Retorna logs recentes
 */
export async function getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { type, limit = 50 } = req.query;

        const logs = await prisma.messageLog.findMany({
            where: type ? { type: type as any } : undefined,
            orderBy: { createdAt: 'desc' },
            take: Math.min(parseInt(limit as string) || 50, 100),
            include: {
                campaign: {
                    select: { name: true },
                },
            },
        });

        res.json({ logs });
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
}
