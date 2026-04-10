import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { whatsappProvider } from '../services/whatsapp-provider.service';
import { leadScoringService } from '../services/lead-scoring.service';

// ==================== LISTAGEM ====================

export const list = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { search, status, groupId, classification, sort, page = '1', limit = '50' } = req.query;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const where: any = { launchId: parseInt(launchId) };

        // Filtro de busca
        if (search) {
            where.OR = [
                { phone: { contains: search as string } },
                { name: { contains: search as string } },
            ];
        }

        // Filtro de status
        if (status === 'active') {
            where.groups = { some: { isActive: true } };
        } else if (status === 'inactive') {
            where.groups = { every: { isActive: false } };
        } else if (status === 'never') {
            where.groups = { none: {} };
        } else if (status === 'blocked') {
            where.isBlocked = true;
        }

        // Filtro de grupo
        if (groupId) {
            where.groups = { some: { groupId: parseInt(groupId as string) } };
        }

        // Filtro de classificação baseado em range de pontos
        if (classification) {
            if (classification === 'HOT') where.score = { gte: 50 };
            else if (classification === 'WARM') where.score = { gte: 20, lt: 50 };
            else if (classification === 'COOL') where.score = { gte: 5, lt: 20 };
            else if (classification === 'COLD') where.score = { lt: 5 };
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        // Ordenação
        let orderBy: any = { lastSeenAt: 'desc' };
        if (sort === 'score_desc') orderBy = { score: 'desc' };
        else if (sort === 'score_asc') orderBy = { score: 'asc' };
        else if (sort === 'oldest') orderBy = { firstClickAt: 'asc' };

        const [leads, total] = await Promise.all([
            prisma.launchLead.findMany({
                where,
                orderBy,
                skip,
                take: parseInt(limit as string),
                include: {
                    groups: {
                        include: {
                            group: { select: { id: true, name: true, number: true } },
                        },
                    },
                },
            }),
            prisma.launchLead.count({ where }),
        ]);

        // Calcular status derivado e classificação
        const leadsWithStatus = leads.map((lead) => {
            const activeGroups = lead.groups.filter((g) => g.isActive).length;
            let status = 'INACTIVE';
            if (lead.isBlocked) {
                status = 'BLOCKED';
            } else if (activeGroups > 0) {
                status = 'ACTIVE';
            }

            return {
                ...lead,
                status,
                activeGroups,
                totalGroups: lead.groups.length,
                classification: leadScoringService.getClassification(lead.score || 0)
            };
        });

        res.json({
            leads: leadsWithStatus,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar leads' });
    }
};

// ==================== DETALHES DO LEAD ====================

export const get = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, leadId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const lead = await prisma.launchLead.findFirst({
            where: { id: parseInt(leadId), launchId: parseInt(launchId) },
            include: {
                groups: {
                    include: {
                        group: { select: { id: true, name: true, number: true, remoteJid: true } },
                    },
                    orderBy: { joinedAt: 'desc' },
                },
            },
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        res.json({ lead });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao buscar lead:', error);
        res.status(500).json({ error: 'Erro ao buscar lead' });
    }
};

// ==================== ATUALIZAR LEAD ====================

export const update = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, leadId } = req.params;
        const userId = req.user!.id;
        const { name, isBlocked } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const lead = await prisma.launchLead.update({
            where: { id: parseInt(leadId) },
            data: {
                ...(name !== undefined && { name }),
                ...(isBlocked !== undefined && { isBlocked }),
            },
        });

        res.json({ lead });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao atualizar:', error);
        res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
};

// ==================== BLOQUEAR LEAD ====================

export const block = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, leadId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launchLead.update({
            where: { id: parseInt(leadId) },
            data: { isBlocked: true },
        });

        res.json({ message: 'Lead bloqueado' });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao bloquear:', error);
        res.status(500).json({ error: 'Erro ao bloquear lead' });
    }
};

// ==================== REMOVER DE GRUPO ====================

export const removeFromGroup = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, leadId, groupId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launchLeadGroup.updateMany({
            where: {
                leadId: parseInt(leadId),
                groupId: parseInt(groupId),
            },
            data: {
                isActive: false,
                leftAt: new Date(),
            },
        });

        res.json({ message: 'Lead removido do grupo' });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao remover de grupo:', error);
        res.status(500).json({ error: 'Erro ao remover lead do grupo' });
    }
};

// ==================== REMOVER DE TODOS OS GRUPOS ====================

export const removeFromAll = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, leadId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launchLeadGroup.updateMany({
            where: { leadId: parseInt(leadId) },
            data: {
                isActive: false,
                leftAt: new Date(),
            },
        });

        res.json({ message: 'Lead removido de todos os grupos' });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao remover de todos:', error);
        res.status(500).json({ error: 'Erro ao remover lead de todos os grupos' });
    }
};

// ==================== EXPORTAR CSV ====================

export const exportCSV = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const leads = await prisma.launchLead.findMany({
            where: { launchId: parseInt(launchId) },
            include: {
                groups: {
                    include: {
                        group: { select: { name: true } },
                    },
                },
            },
            orderBy: { firstClickAt: 'desc' },
        });

        // Gerar CSV
        const header = 'Nome,Telefone,Grupos Ativos,Grupos Inativos,Bloqueado,Primeira Entrada,Última Atividade\n';
        const rows = leads.map((lead) => {
            const activeGroups = lead.groups
                .filter((g) => g.isActive)
                .map((g) => g.group.name)
                .join('; ');
            const inactiveGroups = lead.groups
                .filter((g) => !g.isActive)
                .map((g) => g.group.name)
                .join('; ');

            return [
                lead.name || '',
                lead.phone,
                activeGroups,
                inactiveGroups,
                lead.isBlocked ? 'Sim' : 'Não',
                lead.firstClickAt.toISOString(),
                lead.lastSeenAt.toISOString(),
            ].join(',');
        });

        const csv = header + rows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=leads-${launch.slug}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('[LaunchLeads] Erro ao exportar:', error);
        res.status(500).json({ error: 'Erro ao exportar leads' });
    }
};

// ==================== ESTATÍSTICAS ====================

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const [total, active, blocked, neverJoined] = await Promise.all([
            prisma.launchLead.count({ where: { launchId: parseInt(launchId) } }),
            prisma.launchLead.count({
                where: {
                    launchId: parseInt(launchId),
                    groups: { some: { isActive: true } },
                },
            }),
            prisma.launchLead.count({
                where: { launchId: parseInt(launchId), isBlocked: true },
            }),
            prisma.launchLead.count({
                where: {
                    launchId: parseInt(launchId),
                    groups: { none: {} },
                },
            }),
        ]);

        res.json({
            stats: {
                total,
                active,
                inactive: total - active,
                blocked,
                neverJoined,
            },
        });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
};

// ==================== ENVIAR MENSAGEM PRIVADA ====================

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendPrivateToAll = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { message } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        // Buscar leads ativos (não bloqueados, com pelo menos um grupo ativo)
        const leads = await prisma.launchLead.findMany({
            where: {
                launchId: parseInt(launchId),
                isBlocked: false,
                groups: { some: { isActive: true } },
            },
            select: { id: true, phone: true, name: true },
        });

        if (leads.length === 0) {
            return res.status(400).json({ error: 'Nenhum lead ativo encontrado' });
        }

        console.log(`[LaunchLeads] Enviando mensagem privada para ${leads.length} leads...`);

        let success = 0;
        let failed = 0;
        const errors: { phone: string; error: string }[] = [];

        for (const lead of leads) {
            try {
                // Formatar número para JID de DM
                const phoneJid = `${lead.phone}@s.whatsapp.net`;

                await whatsappProvider.sendMessage(phoneJid, message.trim());
                success++;

                console.log(`[LaunchLeads] ✓ Mensagem enviada para ${lead.phone}`);

                // Delay de 1.5s entre mensagens para evitar rate limit
                if (success + failed < leads.length) {
                    await delay(1500);
                }
            } catch (error: any) {
                failed++;
                const errorMsg = error.message || 'Erro desconhecido';
                errors.push({ phone: lead.phone, error: errorMsg });
                console.error(`[LaunchLeads] ✗ Falha ao enviar para ${lead.phone}:`, errorMsg);
            }
        }

        console.log(`[LaunchLeads] Envio concluído: ${success} sucesso, ${failed} falhas`);

        res.json({
            message: `Mensagem enviada para ${success} leads`,
            stats: { total: leads.length, success, failed },
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limitar erros retornados
        });
    } catch (error) {
        console.error('[LaunchLeads] Erro ao enviar mensagem privada:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem privada' });
    }
};

