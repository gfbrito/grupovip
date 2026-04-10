import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Listar todos os usuários com estatísticas de uso
 * GET /api/admin/users
 */
export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                plan: true,
                _count: {
                    select: {
                        launches: true,
                        campaigns: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Buscar contagem de leads por usuário
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const leadsCount = await prisma.launchLead.count({
                    where: { launch: { userId: user.id } },
                });

                return {
                    ...user,
                    stats: {
                        launches: user._count.launches,
                        campaigns: user._count.campaigns,
                        leads: leadsCount,
                    },
                };
            })
        );

        res.json(usersWithStats);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
}

/**
 * Obter usuário específico com detalhes
 * GET /api/admin/users/:id
 */
export async function getUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                plan: true,
                launches: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        createdAt: true,
                        _count: {
                            select: { groups: true, leads: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        // Estatísticas completas
        const [launchesCount, leadsCount] = await Promise.all([
            prisma.launch.count({ where: { userId: user.id } }),
            prisma.launchLead.count({ where: { launch: { userId: user.id } } }),
        ]);

        res.json({
            ...user,
            stats: {
                launches: launchesCount,
                leads: leadsCount,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
}

/**
 * Atualizar role de um usuário
 * PUT /api/admin/users/:id/role
 */
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['USER', 'ADMIN', 'MASTER'].includes(role)) {
            res.status(400).json({ error: 'Role inválida. Use USER, ADMIN ou MASTER.' });
            return;
        }

        // Não permitir alterar próprio role
        if (req.user && req.user.id === parseInt(id)) {
            res.status(400).json({ error: 'Você não pode alterar sua própria role.' });
            return;
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                plan: true,
            },
        });

        res.json(user);
    } catch (error) {
        console.error('Erro ao atualizar role:', error);
        res.status(500).json({ error: 'Erro ao atualizar role' });
    }
}

/**
 * Deletar usuário
 * DELETE /api/admin/users/:id
 */
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        // Não permitir deletar próprio usuário
        if (req.user && req.user.id === parseInt(id)) {
            res.status(400).json({ error: 'Você não pode deletar sua própria conta.' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { launches: true } } },
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        // Verificar se tem lançamentos
        if (user._count.launches > 0) {
            res.status(400).json({
                error: 'Não é possível deletar um usuário com lançamentos ativos.',
                launchesCount: user._count.launches,
            });
            return;
        }

        await prisma.user.delete({ where: { id: parseInt(id) } });

        res.json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
}

/**
 * Obter estatísticas gerais do sistema
 * GET /api/admin/stats
 */
export async function getSystemStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const [
            usersCount,
            launchesCount,
            leadsCount,
            groupsCount,
            whatsappServersCount,
            planStats,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.launch.count(),
            prisma.launchLead.count(),
            prisma.launchGroup.count(),
            prisma.whatsAppServer.count(),
            prisma.user.groupBy({
                by: ['planId'],
                _count: { id: true },
            }),
        ]);

        // Buscar nomes dos planos
        const plans = await prisma.plan.findMany();
        const planStatsWithNames = planStats.map((stat) => {
            const plan = plans.find((p) => p.id === stat.planId);
            return {
                plan: plan?.displayName || 'Desconhecido',
                planName: plan?.name || 'UNKNOWN',
                count: stat._count.id,
            };
        });

        res.json({
            users: usersCount,
            launches: launchesCount,
            leads: leadsCount,
            groups: groupsCount,
            whatsappServers: whatsappServersCount,
            planDistribution: planStatsWithNames,
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
}

/**
 * Obter configurações globais do Master
 * GET /api/admin/config
 */
export async function getMasterConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const config = await prisma.appConfig.findUnique({
            where: { id: 1 }
        });

        if (!config) {
            res.json({});
            return;
        }

        // Não retorna senhas reais por segurança se quiser mascarar, 
        // mas sendo Master panel é comum retornar. Para maior segurança, retorne mask.
        res.json({
            paypalClientId: config.paypalClientId || '',
            paypalSecret: config.paypalSecret ? '********' : '',
            paypalWebhookId: config.paypalWebhookId || '',
            smtpHost: config.smtpHost || '',
            smtpPort: config.smtpPort || '',
            smtpUser: config.smtpUser || '',
            smtpPass: config.smtpPass ? '********' : '',
            enableAI: config.enableAI ?? true,
        });
    } catch (error) {
        console.error('Erro ao buscar master config:', error);
        res.status(500).json({ error: 'Erro interno ao buscar configurações' });
    }
}

/**
 * Atualizar configurações globais do Master
 * PUT /api/admin/config
 */
export async function updateMasterConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const data = req.body;
        const currentConfig = await prisma.appConfig.findUnique({ where: { id: 1 } });
        
        // Mantém senha antiga se recebeu '********' ou vazio que represente não mudar
        const updateData: any = {
            paypalClientId: data.paypalClientId,
            paypalWebhookId: data.paypalWebhookId,
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpUser: data.smtpUser,
            enableAI: data.enableAI !== undefined ? data.enableAI : true,
        };

        if (data.paypalSecret && data.paypalSecret !== '********') {
            updateData.paypalSecret = data.paypalSecret;
        }

        if (data.smtpPass && data.smtpPass !== '********') {
            updateData.smtpPass = data.smtpPass;
        }

        const updated = await prisma.appConfig.upsert({
            where: { id: 1 },
            update: updateData,
            create: {
                id: 1,
                ...updateData
            }
        });

        res.json({ message: 'Configurações atualizadas com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar master config:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar configurações' });
    }
}
