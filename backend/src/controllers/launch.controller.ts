import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { createAIProvider } from '../services/ai.service';
import { AICreditsService } from '../services/ai-credits.service';

// ==================== CRUD ====================

export const list = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const launches = await prisma.launch.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        groups: true,
                        leads: true,
                        clicks: true,
                    },
                },
            },
        });

        // Adicionar métricas resumidas
        const launchesWithStats = await Promise.all(
            launches.map(async (launch) => {
                const [activeLeads, todayClicks] = await Promise.all([
                    prisma.launchLeadGroup.count({
                        where: {
                            group: { launchId: launch.id },
                            isActive: true,
                        },
                    }),
                    prisma.launchClick.count({
                        where: {
                            launchId: launch.id,
                            createdAt: {
                                gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            },
                        },
                    }),
                ]);

                return {
                    ...launch,
                    stats: {
                        totalGroups: launch._count.groups,
                        totalLeads: launch._count.leads,
                        totalClicks: launch._count.clicks,
                        activeLeads,
                        todayClicks,
                    },
                };
            })
        );

        res.json({ launches: launchesWithStats });
    } catch (error) {
        console.error('[Launch] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar lançamentos' });
    }
};

export const get = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(id), userId },
            include: {
                groups: {
                    orderBy: { number: 'asc' },
                },
                _count: {
                    select: {
                        leads: true,
                        clicks: true,
                        actions: true,
                        messages: true,
                    },
                },
            },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        // Métricas detalhadas
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            activeLeads,
            todayClicks,
            todayEntries,
            clicksLast7Days,
            entriesLast7Days,
            totalCapacity,
            totalMembers,
            queuePending,
        ] = await Promise.all([
            prisma.launchLeadGroup.count({
                where: { group: { launchId: launch.id }, isActive: true },
            }),
            prisma.launchClick.count({
                where: { launchId: launch.id, createdAt: { gte: today } },
            }),
            prisma.launchLeadGroup.count({
                where: { group: { launchId: launch.id }, joinedAt: { gte: today } },
            }),
            prisma.launchClick.groupBy({
                by: ['createdAt'],
                where: { launchId: launch.id, createdAt: { gte: last7Days } },
                _count: true,
            }),
            prisma.launchLeadGroup.count({
                where: { group: { launchId: launch.id }, joinedAt: { gte: last7Days } },
            }),
            prisma.launchGroup.aggregate({
                where: { launchId: launch.id },
                _sum: { memberCount: true },
            }),
            launch.groups.reduce((sum, g) => sum + g.memberCount, 0),
            prisma.groupCreationQueue.count({
                where: { launchId: launch.id, status: 'PENDING' },
            }),
        ]);

        const capacity = launch.groups.length * launch.memberLimit;
        const fullGroups = launch.groups.filter(
            (g) => g.memberCount >= launch.memberLimit
        ).length;

        res.json({
            launch,
            stats: {
                totalClicks: launch._count.clicks,
                totalLeads: launch._count.leads,
                activeLeads,
                todayClicks,
                todayEntries,
                entriesLast7Days,
                totalGroups: launch.groups.length,
                fullGroups,
                capacity,
                totalMembers,
                queuePending,
                conversionRate:
                    launch._count.clicks > 0
                        ? ((activeLeads / launch._count.clicks) * 100).toFixed(1)
                        : '0',
            },
        });
    } catch (error) {
        console.error('[Launch] Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro ao buscar lançamento' });
    }
};

export const create = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const {
            name,
            slug,
            description,
            logoUrl,
            memberLimit = 256,
            initialGroups = 3,
            groupNamePattern = '{nome} - Grupo {n}',
            groupDescription,
            autoCreateGroup = true,
            autoCreateAt = 90,
            metaPixelEnabled = false,
            metaPixelId,
            gtmEnabled = false,
            gtmId
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        // Gerar slug único se não fornecido ou sanitizar
        let finalSlug = slug;
        if (!finalSlug) {
            finalSlug = name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }

        // Verificar unicidade
        let slugExists = await prisma.launch.findUnique({ where: { slug: finalSlug } });
        let suffix = 1;
        const originalSlug = finalSlug;
        while (slugExists) {
            finalSlug = `${originalSlug}-${suffix}`;
            slugExists = await prisma.launch.findUnique({ where: { slug: finalSlug } });
            suffix++;
        }

        // Criar Lançamento com transação para garantir grupos
        const launch = await prisma.$transaction(async (tx) => {
            const newLaunch = await tx.launch.create({
                data: {
                    name,
                    slug: finalSlug,
                    description,
                    logoUrl,
                    memberLimit: Number(memberLimit),
                    autoCreateGroup,
                    autoCreateAt: Number(autoCreateAt),
                    metaPixelEnabled,
                    metaPixelId,
                    gtmEnabled,
                    gtmId,
                    userId,
                }
            });

            // Agendar criação de grupos (2 minutos de intervalo)
            if (initialGroups > 0) {
                const now = new Date();
                const queueItems = [];

                for (let i = 1; i <= initialGroups; i++) {
                    const scheduledAt = new Date(now.getTime() + (i - 1) * 2 * 60 * 1000);
                    const groupName = groupNamePattern
                        .replace(/{nome}/gi, name)
                        .replace(/{n}/gi, String(i));

                    queueItems.push({
                        launchId: newLaunch.id,
                        name: groupName,
                        description: groupDescription || null,
                        number: i,
                        scheduledAt,
                    });
                }

                await tx.groupCreationQueue.createMany({ data: queueItems });
            }

            return newLaunch;
        });

        console.log(`[Launch] Criado: ${launch.name} (${launch.slug}) com ${initialGroups} grupos agendados`);

        res.status(201).json({
            launch,
            message: `Lançamento criado com ${initialGroups} grupos agendados`,
        });
    } catch (error) {
        console.error('[Launch] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro ao criar lançamento' });
    }
};

export const generateMagicLaunch = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { productInfo, eventDate } = req.body;

        if (!productInfo || productInfo.trim().length < 10) {
            return res.status(400).json({ error: 'Forneça uma descrição detalhada do produto.' });
        }

        // Custo fixo para gerar lançamento completo
        const MAGIC_LAUNCH_CREDIT_COST = 15;

        // Verificar créditos do usuário
        try {
            await AICreditsService.checkCredits(userId, MAGIC_LAUNCH_CREDIT_COST);
        } catch (err: any) {
            return res.status(402).json({ error: 'Saldo de créditos de IA insuficiente.' });
        }

        const globalAIConfig = await prisma.aIConfig.findUnique({ where: { id: 1 } });
        if (!globalAIConfig?.apiKey) {
            return res.status(400).json({ error: 'IA não configurada globalmente.' });
        }

        const aiProvider = createAIProvider(
            globalAIConfig.provider as 'OPENAI' | 'GEMINI',
            globalAIConfig.apiKey,
            globalAIConfig.model
        );

        // Gera a resposta mágica
        const magicLaunch = await aiProvider.generateLaunch(productInfo, eventDate);

        // Criar o Lançamento
        let slug = magicLaunch.launchName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

        let slugExists = await prisma.launch.findUnique({ where: { slug } });
        let suffix = 1;
        const originalSlug = slug;
        while (slugExists) {
            slug = `${originalSlug}-${suffix}`;
            slugExists = await prisma.launch.findUnique({ where: { slug } });
            suffix++;
        }

        const launch = await prisma.$transaction(async (tx) => {
            const newLaunch = await tx.launch.create({
                data: {
                    name: magicLaunch.launchName,
                    slug,
                    description: magicLaunch.description || productInfo,
                    memberLimit: 256,
                    autoCreateGroup: true,
                    autoCreateAt: 90,
                    userId,
                }
            });

            // Agendar criação dos grupos mágicos
            const now = new Date();
            const queueItems = magicLaunch.groups.map((g, index) => {
                return {
                    launchId: newLaunch.id,
                    name: g.name,
                    description: g.description,
                    number: index + 1,
                    scheduledAt: new Date(now.getTime() + (index * 2 * 60 * 1000)),
                };
            });
            
            if (queueItems.length > 0) {
                await tx.groupCreationQueue.createMany({ data: queueItems });
            }

            // Agendar Campanhas Mágicas
            for (const msg of magicLaunch.messages) {
                const scheduleTime = new Date(now);
                scheduleTime.setDate(scheduleTime.getDate() + msg.day);
                // Define horário comercial genérico
                scheduleTime.setHours(10, 0, 0, 0);

                await tx.campaign.create({
                    data: {
                        name: `Mensagem Dia ${msg.day}`,
                        message: msg.content,
                        status: 'SCHEDULED',
                        scheduledAt: scheduleTime,
                        userId
                    }
                });
            }

            // Criar AI Config para o lançamento (HABILITANDO auto resposta no inbox)
            await tx.launchAIConfig.create({
                data: {
                    launchId: newLaunch.id,
                    isEnabled: true,
                    autoReply: false,
                    systemPrompt: \`Você é um assistente do lançamento \${magicLaunch.launchName}. Aja de forma persuasiva baseada no produto: \${productInfo}\`
                }
            });

            return newLaunch;
        });

        // Consumir créditos
        await AICreditsService.consumeCredits(
            userId,
            'LAUNCH_GENERATION',
            MAGIC_LAUNCH_CREDIT_COST,
            globalAIConfig.model || 'unknown',
            launch.id,
            'Launch'
        );

        res.status(201).json({
            launch,
            magicDetails: magicLaunch,
            message: 'Lançamento gerado com Mágica IA! 🪄'
        });

    } catch (error) {
        console.error('[Launch] Erro ao gerar com IA:', error);
        res.status(500).json({ error: 'Falha na Mágica. Verifique os logs.' });
    }
};

export const update = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const updates = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(id), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        // Se estiver atualizando o slug, verificar unicidade
        if (updates.slug && updates.slug !== launch.slug) {
            const slugExists = await prisma.launch.findUnique({
                where: { slug: updates.slug },
            });
            if (slugExists) {
                return res.status(400).json({ error: 'Slug já está em uso' });
            }
        }

        const allowedUpdates = {
            name: updates.name,
            slug: updates.slug,
            description: updates.description,
            logoUrl: updates.logoUrl,
            status: updates.status,
            memberLimit: updates.memberLimit ? Number(updates.memberLimit) : undefined,
            autoCreateGroup: updates.autoCreateGroup,
            autoCreateAt: updates.autoCreateAt ? Number(updates.autoCreateAt) : undefined,
            metaPixelEnabled: updates.metaPixelEnabled,
            metaPixelId: updates.metaPixelId,
            gtmEnabled: updates.gtmEnabled,
            gtmId: updates.gtmId
        };
        // Remover undefined keys
        Object.keys(allowedUpdates).forEach(key => allowedUpdates[key as keyof typeof allowedUpdates] === undefined && delete allowedUpdates[key as keyof typeof allowedUpdates]);

        const updated = await prisma.launch.update({
            where: { id: parseInt(id) },
            data: allowedUpdates,
        });

        res.json({ launch: updated });
    } catch (error) {
        console.error('[Launch] Erro ao atualizar:', error);
        res.status(500).json({ error: 'Erro ao atualizar lançamento' });
    }
};

export const remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(id), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launch.delete({ where: { id: parseInt(id) } });

        res.json({ message: 'Lançamento excluído com sucesso' });
    } catch (error) {
        console.error('[Launch] Erro ao excluir:', error);
        res.status(500).json({ error: 'Erro ao excluir lançamento' });
    }
};

// ==================== ESTATÍSTICAS ====================

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { period = '7' } = req.query;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(id), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const days = parseInt(period as string);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Buscar cliques e entradas por dia
        const clicks = await prisma.launchClick.findMany({
            where: {
                launchId: launch.id,
                createdAt: { gte: startDate },
            },
            select: { createdAt: true, converted: true },
        });

        const entries = await prisma.launchLeadGroup.findMany({
            where: {
                group: { launchId: launch.id },
                joinedAt: { gte: startDate },
            },
            select: { joinedAt: true },
        });

        // Agrupar por dia
        const clicksByDay: Record<string, number> = {};
        const entriesByDay: Record<string, number> = {};

        clicks.forEach((c) => {
            const day = c.createdAt.toISOString().split('T')[0];
            clicksByDay[day] = (clicksByDay[day] || 0) + 1;
        });

        entries.forEach((e) => {
            const day = e.joinedAt.toISOString().split('T')[0];
            entriesByDay[day] = (entriesByDay[day] || 0) + 1;
        });

        // Gerar array de dias
        const stats = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const day = date.toISOString().split('T')[0];

            const dayClicks = clicksByDay[day] || 0;
            const dayEntries = entriesByDay[day] || 0;

            stats.push({
                date: day,
                clicks: dayClicks,
                entries: dayEntries,
                conversion: dayClicks > 0 ? ((dayEntries / dayClicks) * 100).toFixed(1) : '0',
            });
        }

        res.json({ stats });
    } catch (error) {
        console.error('[Launch] Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
};
