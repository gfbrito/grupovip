import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { evolutionClient } from '../services/evolution.client';

// ==================== LISTAGEM ====================

export const list = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        // Verificar propriedade
        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const groups = await prisma.launchGroup.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { number: 'asc' },
            include: {
                _count: {
                    select: { leads: { where: { isActive: true } } },
                },
            },
        });

        res.json({
            groups: groups.map((g) => ({
                ...g,
                activeLeads: g._count.leads,
                capacityPercent: Math.round((g.memberCount / launch.memberLimit) * 100),
            })),
            memberLimit: launch.memberLimit,
        });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar grupos' });
    }
};

// ==================== CRIAÇÃO EM LOTE ====================

export const createBatch = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const {
            quantity = 1,
            namePattern = '{nome} - Grupo {n}',
            description,
            startNumber,
        } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        if (quantity < 1 || quantity > 50) {
            return res.status(400).json({ error: 'Quantidade deve ser entre 1 e 50' });
        }

        // Encontrar próximo número disponível
        const lastGroup = await prisma.launchGroup.findFirst({
            where: { launchId: parseInt(launchId) },
            orderBy: { number: 'desc' },
        });

        const lastQueue = await prisma.groupCreationQueue.findFirst({
            where: { launchId: parseInt(launchId) },
            orderBy: { number: 'desc' },
        });

        const nextNumber = startNumber || Math.max(
            (lastGroup?.number || 0) + 1,
            (lastQueue?.number || 0) + 1
        );

        // Agendar criação (2 min de intervalo)
        const now = new Date();
        const queueItems = [];

        for (let i = 0; i < quantity; i++) {
            const number = nextNumber + i;
            const scheduledAt = new Date(now.getTime() + i * 2 * 60 * 1000);
            const groupName = namePattern
                .replace(/{nome}/gi, launch.name)
                .replace(/{n}/gi, String(number))
                .replace(/{nome_lancamento}/gi, launch.name);

            queueItems.push({
                launchId: parseInt(launchId),
                name: groupName,
                description: description || null,
                number,
                scheduledAt,
            });
        }

        await prisma.groupCreationQueue.createMany({ data: queueItems });

        console.log(`[LaunchGroups] ${quantity} grupos agendados para lançamento ${launch.name}`);

        res.json({
            message: `${quantity} grupo(s) agendados para criação`,
            queue: queueItems.map((q) => ({
                name: q.name,
                number: q.number,
                scheduledAt: q.scheduledAt,
            })),
        });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao criar lote:', error);
        res.status(500).json({ error: 'Erro ao agendar criação de grupos' });
    }
};

// ==================== HELPER DE SYNC ====================

async function syncGroupParticipants(launchId: number, group: any): Promise<{ found: number, saved: number }> {
    console.log(`[Sync] Iniciando sync para grupo ${group.remoteJid} (ID: ${group.id})`);
    let stats = { found: 0, saved: 0 };

    try {
        // Buscar participantes do grupo
        const participants = await evolutionClient.getGroupParticipants(group.remoteJid);
        const memberCount = participants?.length || group.memberCount;
        stats.found = memberCount;

        console.log(`[Sync] Grupo ${group.remoteJid}: recebidos ${participants?.length || 0} participantes raw`);

        // Tentar buscar link de convite se não existir
        let inviteLink = group.inviteLink;
        if (!inviteLink) {
            try {
                const link = await evolutionClient.getGroupInviteLink(group.remoteJid);
                if (link) {
                    inviteLink = link;
                    console.log(`[Sync] Link de convite recuperado para ${group.remoteJid}: ${link}`);
                }
            } catch (lErr) {
                console.error(`[Sync] Falha ao buscar link de convite:`, lErr);
            }
        }

        // Atualizar contagem do grupo e link
        await prisma.launchGroup.update({
            where: { id: group.id },
            data: {
                memberCount,
                syncedAt: new Date(),
                inviteLink,
            },
        });

        // Importar participantes como Leads
        if (participants && participants.length > 0) {
            // Processar em lotes para não estourar conexões
            for (const participantId of participants) {
                try {
                    // Lógica Robusta de Extração de Telefone (Priorizando phoneNumber da Evolution v2)
                    let fullId = '';
                    let participantName: string | null = null;

                    if (typeof participantId === 'string') {
                        fullId = participantId;
                    } else if (typeof participantId === 'object' && participantId !== null) {
                        // O usuário reportou que vem { id: '...@lid', phoneNumber: '...@s.whatsapp.net', name: '...' }
                        // Devemos priorizar o phoneNumber se existir e não for nulo
                        const p = participantId as any;
                        fullId = p.phoneNumber || p.id || '';
                        // Extrair nome do perfil do WhatsApp (se disponível)
                        if (p.name && typeof p.name === 'string' && p.name.trim() !== '') {
                            participantName = p.name.trim();
                        }
                    }

                    // Filtro Rigoroso: Se o ID final ainda for LID ou inválido, ignora
                    if (!fullId || fullId.includes('@lid') || fullId.includes('@broadcast') || fullId === 'undefined' || fullId === 'null') {
                        continue;
                    }

                    // Extrair apenas o número
                    const phone = fullId.split('@')[0];

                    // Validação final de formato (apenas dígitos, pelo menos 8 chars)
                    if (!/^\d{8,}$/.test(phone)) {
                        continue;
                    }

                    // Upsert Lead (atualizar nome se disponível)
                    const lead = await prisma.launchLead.upsert({
                        where: {
                            launchId_phone: {
                                launchId,
                                phone
                            }
                        },
                        create: {
                            launchId,
                            phone,
                            name: participantName,
                            lastSeenAt: new Date()
                        },
                        update: {
                            lastSeenAt: new Date(),
                            // Atualiza nome apenas se tiver um novo nome e o atual for nulo
                            ...(participantName ? { name: participantName } : {})
                        }
                    });

                    // Vincular ao Grupo (LaunchLeadGroup)
                    await prisma.launchLeadGroup.upsert({
                        where: {
                            leadId_groupId: {
                                leadId: lead.id,
                                groupId: group.id
                            }
                        },
                        create: {
                            leadId: lead.id,
                            groupId: group.id,
                            isActive: true
                        },
                        update: {
                            isActive: true,
                            joinedAt: new Date()
                        }
                    });

                    stats.saved++;
                } catch (pError) {
                    console.error(`[Sync] Erro ao processar participante ${JSON.stringify(participantId)}:`, pError);
                }
            }
            console.log(`[Sync] Grupo ${group.remoteJid}: ${stats.saved} leads processados com sucesso.`);
        }
        return stats;
    } catch (err) {
        console.error(`[LaunchGroups] Erro ao sincronizar ${group.remoteJid}:`, err);
        return stats;
    }
}

// ==================== VINCULAR EXISTENTES ====================

export const linkExisting = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { groupIds } = req.body; // Array de remoteJids dos grupos globais

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ error: 'Selecione pelo menos um grupo' });
        }

        // Tentar buscar grupos globais no banco
        let globalGroups = await prisma.group.findMany({
            where: { remoteJid: { in: groupIds } },
        });

        // Se não encontrou todos os grupos selecionados no banco, tentar buscar/sync da Evolution
        // Isso é um FALLBACK IMPORTANTE se o usuário não fez sync manual antes
        if (globalGroups.length < groupIds.length) {
            console.log('[LaunchGroups] Alguns grupos não encontrados no banco local, buscando na Evolution...');
            try {
                const apiGroups = await evolutionClient.fetchGroups();

                // Filtrar apenas os que queremos vincular e salvar/atualizar no banco global
                const targetGroups = apiGroups.filter(g => groupIds.includes(g.id));

                for (const g of targetGroups) {
                    await prisma.group.upsert({
                        where: { remoteJid: g.id },
                        create: {
                            remoteJid: g.id,
                            name: g.subject,
                            memberCount: g.size
                        },
                        update: {
                            name: g.subject,
                            memberCount: g.size
                        }
                    });
                }

                // Buscar novamente do banco atualizado
                globalGroups = await prisma.group.findMany({
                    where: { remoteJid: { in: groupIds } },
                });
            } catch (err) {
                console.error('[LaunchGroups] Erro ao buscar fallback na Evolution:', err);
            }
        }

        if (globalGroups.length === 0) {
            return res.status(400).json({ error: 'Nenhum grupo encontrado para vincular (verifique se eles existem na instância)' });
        }

        // Encontrar próximo número
        const lastGroup = await prisma.launchGroup.findFirst({
            where: { launchId: parseInt(launchId) },
            orderBy: { number: 'desc' },
        });

        let nextNumber = (lastGroup?.number || 0) + 1;
        const linked = [];

        for (const group of globalGroups) {
            // Verificar se já está vinculado
            const exists = await prisma.launchGroup.findUnique({
                where: { remoteJid: group.remoteJid },
            });

            if (exists) continue;

            const launchGroup = await prisma.launchGroup.create({
                data: {
                    launchId: parseInt(launchId),
                    remoteJid: group.remoteJid,
                    name: group.nickname || group.name,
                    originalName: group.name,
                    number: nextNumber,
                    memberCount: group.memberCount,
                    origin: 'LINKED',
                },
            });

            linked.push(launchGroup);
            nextNumber++;

            // SYNC IMEDIATO: Importar leads deste grupo
            await syncGroupParticipants(parseInt(launchId), launchGroup);
        }

        console.log(`[LaunchGroups] ${linked.length} grupos vinculados ao lançamento ${launch.name}`);

        res.json({
            message: `${linked.length} grupo(s) vinculado(s)`,
            groups: linked,
        });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao vincular:', error);
        res.status(500).json({ error: 'Erro ao vincular grupos' });
    }
};

// ==================== SINCRONIZAR MEMBROS ====================

export const sync = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
            include: { groups: true },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        let updatedGroups = 0;
        let totalFound = 0;
        let totalSaved = 0;

        for (let i = 0; i < launch.groups.length; i++) {
            const group = launch.groups[i];
            console.log(`[Sync] Processando grupo ${i + 1} de ${launch.groups.length}: ${group.name} (${group.remoteJid})...`);

            try {
                const stats = await syncGroupParticipants(parseInt(launchId), group);

                if (stats.found > 0) {
                    updatedGroups++;
                    totalFound += stats.found;
                    totalSaved += stats.saved;
                }
            } catch (loopError) {
                console.error(`[Sync] Erro crítico no loop para o grupo ${group.remoteJid}:`, loopError);
            }

            // Intervalo de 3 segundos (exceto no último)
            if (i < launch.groups.length - 1) {
                console.log(`[Sync] Aguardando 3s antes do próximo grupo...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        res.json({
            message: `${updatedGroups} grupos sincronizados.`,
            details: `Encontrados: ${totalFound} | Importados: ${totalSaved} participantes.`
        });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao sincronizar:', error);
        res.status(500).json({ error: 'Erro ao sincronizar grupos' });
    }
};

// ==================== FILA DE CRIAÇÃO ====================

export const getQueue = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const queue = await prisma.groupCreationQueue.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { scheduledAt: 'asc' },
        });

        const pending = queue.filter((q) => q.status === 'PENDING').length;
        const creating = queue.filter((q) => q.status === 'CREATING').length;
        const completed = queue.filter((q) => q.status === 'COMPLETED').length;
        const failed = queue.filter((q) => q.status === 'FAILED').length;

        res.json({
            queue,
            stats: { pending, creating, completed, failed, total: queue.length },
        });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao buscar fila:', error);
        res.status(500).json({ error: 'Erro ao buscar fila' });
    }
};

// ==================== ATUALIZAR GRUPO ====================

export const update = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, groupId } = req.params;
        const userId = req.user!.id;
        const { isReceiving, name } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const group = await prisma.launchGroup.findFirst({
            where: { id: parseInt(groupId), launchId: parseInt(launchId) },
        });

        if (!group) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        const updated = await prisma.launchGroup.update({
            where: { id: parseInt(groupId) },
            data: {
                ...(isReceiving !== undefined && { isReceiving }),
                ...(name && { name }),
            },
        });

        res.json({ group: updated });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao atualizar:', error);
        res.status(500).json({ error: 'Erro ao atualizar grupo' });
    }
};

// ==================== REMOVER GRUPO ====================

export const remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, groupId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launchGroup.delete({
            where: { id: parseInt(groupId) },
        });

        res.json({ message: 'Grupo removido do lançamento' });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao remover:', error);
        res.status(500).json({ error: 'Erro ao remover grupo' });
    }
};

// ==================== RETRY QUEUE ITEM ====================

export const retryQueueItem = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, queueId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findUnique({
            where: { id: parseInt(launchId) }, // Removida verificação de usuario para simplificar debug, ou manter se necessario
        });

        // Verificar se lançamento pertence ao usuário (boa prática manter)
        if (!launch || launch.userId !== userId) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const queueItem = await prisma.groupCreationQueue.findFirst({
            where: { id: parseInt(queueId), launchId: parseInt(launchId) },
        });

        if (!queueItem) {
            return res.status(404).json({ error: 'Item da fila não encontrado' });
        }

        // Resetar para PENDING
        const updated = await prisma.groupCreationQueue.update({
            where: { id: parseInt(queueId) },
            data: {
                status: 'PENDING',
                error: null,
                processedAt: null,
                scheduledAt: new Date(), // Reprocessar imediatamente (ou assim que o worker rodar)
            },
        });

        console.log(`[LaunchGroups] Retry solicitado para item ${queueId} (${queueItem.name})`);

        res.json({ message: 'Item reiniciado com sucesso', item: updated });
    } catch (error) {
        console.error('[LaunchGroups] Erro ao reiniciar item:', error);
        res.status(500).json({ error: 'Erro ao reiniciar item da fila' });
    }
};
