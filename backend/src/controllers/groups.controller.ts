import { Response } from 'express';
import { prisma } from '../config/database';
import { evolutionClient } from '../services/evolution.client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/groups
 * Lista todos os grupos do banco
 */
export async function listGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const groups = await prisma.group.findMany({
            orderBy: { name: 'asc' },
        });

        res.json({ groups });
    } catch (error) {
        console.error('Erro ao listar grupos:', error);
        res.status(500).json({ error: 'Erro ao listar grupos' });
    }
}

/**
 * POST /api/groups/sync
 * Sincroniza grupos com a Evolution API
 */
export async function syncGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        // Buscar grupos da Evolution API
        const evolutionGroups = await evolutionClient.fetchGroups();

        if (!evolutionGroups.length) {
            res.json({
                message: 'Nenhum grupo encontrado na instância',
                synced: 0,
                total: 0,
            });
            return;
        }

        let syncedCount = 0;

        for (const group of evolutionGroups) {
            // Upsert: atualiza se existe, cria se não existe
            // Preserva nickname e isActive existentes
            await prisma.group.upsert({
                where: { remoteJid: group.id },
                update: {
                    name: group.subject,
                    memberCount: group.size || 0,
                    syncedAt: new Date(),
                },
                create: {
                    remoteJid: group.id,
                    name: group.subject,
                    memberCount: group.size || 0,
                    isActive: true,
                },
            });
            syncedCount++;
        }

        // Log de sucesso
        await prisma.messageLog.create({
            data: {
                type: 'SUCCESS',
                message: `${syncedCount} grupos sincronizados com sucesso`,
            },
        });

        res.json({
            message: `${syncedCount} grupos sincronizados`,
            synced: syncedCount,
            total: evolutionGroups.length,
        });
    } catch (error) {
        console.error('Erro ao sincronizar grupos:', error);

        // Log de erro
        await prisma.messageLog.create({
            data: {
                type: 'ERROR',
                message: 'Falha ao sincronizar grupos',
                metadata: JSON.stringify({ error: String(error) }),
            },
        });

        res.status(500).json({ error: 'Erro ao sincronizar grupos' });
    }
}

/**
 * PATCH /api/groups/:id
 * Atualiza nickname ou isActive de um grupo
 */
export async function updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { nickname, isActive } = req.body;

        const group = await prisma.group.findUnique({
            where: { id: parseInt(id) },
        });

        if (!group) {
            res.status(404).json({ error: 'Grupo não encontrado' });
            return;
        }

        const updated = await prisma.group.update({
            where: { id: parseInt(id) },
            data: {
                ...(nickname !== undefined && { nickname: nickname || null }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json({
            message: 'Grupo atualizado',
            group: updated,
        });
    } catch (error) {
        console.error('Erro ao atualizar grupo:', error);
        res.status(500).json({ error: 'Erro ao atualizar grupo' });
    }
}

/**
 * GET /api/groups/stats
 * Retorna estatísticas dos grupos
 */
export async function getGroupStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const total = await prisma.group.count();
        const active = await prisma.group.count({ where: { isActive: true } });

        res.json({
            total,
            active,
            inactive: total - active,
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
}
