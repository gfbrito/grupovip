import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Listar todos os planos
 * GET /api/plans
 */
export async function listPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });

        res.json(plans);
    } catch (error) {
        console.error('Erro ao listar planos:', error);
        res.status(500).json({ error: 'Erro ao listar planos' });
    }
}

/**
 * Obter plano por ID
 * GET /api/plans/:id
 */
export async function getPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const plan = await prisma.plan.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });

        if (!plan) {
            res.status(404).json({ error: 'Plano não encontrado' });
            return;
        }

        res.json(plan);
    } catch (error) {
        console.error('Erro ao buscar plano:', error);
        res.status(500).json({ error: 'Erro ao buscar plano' });
    }
}

/**
 * Criar novo plano (MASTER only)
 * POST /api/plans
 */
export async function createPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const {
            name,
            displayName,
            maxLaunches = 1,
            maxGroupsPerLaunch = 3,
            maxLeads = 500,
            maxWhatsAppServers = 1,
            aiEnabled = false,
            privateMessagesEnabled = false,
            webhooksEnabled = false,
            price = 0,
            billingPeriod = 'MONTHLY',
        } = req.body;

        if (!name || !displayName) {
            res.status(400).json({ error: 'Nome e nome de exibição são obrigatórios' });
            return;
        }

        // Verificar se nome já existe
        const existing = await prisma.plan.findUnique({ where: { name } });
        if (existing) {
            res.status(409).json({ error: 'Já existe um plano com este nome' });
            return;
        }

        const plan = await prisma.plan.create({
            data: {
                name: name.toUpperCase(),
                displayName,
                maxLaunches,
                maxGroupsPerLaunch,
                maxLeads,
                maxWhatsAppServers,
                aiEnabled,
                privateMessagesEnabled,
                webhooksEnabled,
                price,
                billingPeriod,
            },
        });

        res.status(201).json(plan);
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        res.status(500).json({ error: 'Erro ao criar plano' });
    }
}

/**
 * Atualizar plano (MASTER only)
 * PUT /api/plans/:id
 */
export async function updatePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const {
            displayName,
            maxLaunches,
            maxGroupsPerLaunch,
            maxLeads,
            maxWhatsAppServers,
            aiEnabled,
            privateMessagesEnabled,
            webhooksEnabled,
            price,
            billingPeriod,
        } = req.body;

        const plan = await prisma.plan.findUnique({ where: { id: parseInt(id) } });
        if (!plan) {
            res.status(404).json({ error: 'Plano não encontrado' });
            return;
        }

        const updatedPlan = await prisma.plan.update({
            where: { id: parseInt(id) },
            data: {
                ...(displayName !== undefined && { displayName }),
                ...(maxLaunches !== undefined && { maxLaunches }),
                ...(maxGroupsPerLaunch !== undefined && { maxGroupsPerLaunch }),
                ...(maxLeads !== undefined && { maxLeads }),
                ...(maxWhatsAppServers !== undefined && { maxWhatsAppServers }),
                ...(aiEnabled !== undefined && { aiEnabled }),
                ...(privateMessagesEnabled !== undefined && { privateMessagesEnabled }),
                ...(webhooksEnabled !== undefined && { webhooksEnabled }),
                ...(price !== undefined && { price }),
                ...(billingPeriod !== undefined && { billingPeriod }),
            },
        });

        res.json(updatedPlan);
    } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        res.status(500).json({ error: 'Erro ao atualizar plano' });
    }
}

/**
 * Deletar plano (MASTER only)
 * DELETE /api/plans/:id
 */
export async function deletePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const plan = await prisma.plan.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { users: true } } },
        });

        if (!plan) {
            res.status(404).json({ error: 'Plano não encontrado' });
            return;
        }

        // Não permitir deletar plano com usuários
        if (plan._count.users > 0) {
            res.status(400).json({
                error: 'Não é possível deletar um plano que possui usuários vinculados',
                usersCount: plan._count.users,
            });
            return;
        }

        // Não permitir deletar plano FREE (id=1)
        if (plan.name === 'FREE') {
            res.status(400).json({ error: 'Não é possível deletar o plano gratuito' });
            return;
        }

        await prisma.plan.delete({ where: { id: parseInt(id) } });

        res.json({ message: 'Plano deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar plano:', error);
        res.status(500).json({ error: 'Erro ao deletar plano' });
    }
}

/**
 * Listar usuários de um plano (MASTER only)
 * GET /api/plans/:id/users
 */
export async function getPlanUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const users = await prisma.user.findMany({
            where: { planId: parseInt(id) },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                _count: {
                    select: { launches: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(users);
    } catch (error) {
        console.error('Erro ao listar usuários do plano:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
}

/**
 * Alterar plano de um usuário (MASTER only)
 * PUT /api/users/:userId/plan
 */
export async function changeUserPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { userId } = req.params;
        const { planId } = req.body;

        if (!planId) {
            res.status(400).json({ error: 'planId é obrigatório' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        const plan = await prisma.plan.findUnique({ where: { id: parseInt(planId) } });
        if (!plan) {
            res.status(404).json({ error: 'Plano não encontrado' });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { planId: parseInt(planId) },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                plan: true,
            },
        });

        res.json(updatedUser);
    } catch (error) {
        console.error('Erro ao alterar plano do usuário:', error);
        res.status(500).json({ error: 'Erro ao alterar plano' });
    }
}

/**
 * Obter uso atual do usuário logado
 * GET /api/my-usage
 */
export async function getMyUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { plan: true },
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        // Contar uso atual
        const [launchesCount, leadsCount, whatsappServersCount] = await Promise.all([
            prisma.launch.count({ where: { userId: user.id } }),
            prisma.launchLead.count({ where: { launch: { userId: user.id } } }),
            prisma.whatsAppServer.count(),
        ]);

        res.json({
            plan: user.plan,
            usage: {
                launches: {
                    current: launchesCount,
                    limit: user.plan.maxLaunches,
                    percentage: Math.round((launchesCount / user.plan.maxLaunches) * 100),
                },
                leads: {
                    current: leadsCount,
                    limit: user.plan.maxLeads,
                    percentage: Math.round((leadsCount / user.plan.maxLeads) * 100),
                },
                whatsappServers: {
                    current: whatsappServersCount,
                    limit: user.plan.maxWhatsAppServers,
                    percentage: Math.round((whatsappServersCount / user.plan.maxWhatsAppServers) * 100),
                },
            },
            features: {
                ai: user.plan.aiEnabled,
                privateMessages: user.plan.privateMessagesEnabled,
                webhooks: user.plan.webhooksEnabled,
            },
        });
    } catch (error) {
        console.error('Erro ao obter uso:', error);
        res.status(500).json({ error: 'Erro ao obter uso' });
    }
}
