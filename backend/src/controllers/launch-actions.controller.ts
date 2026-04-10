import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';

// ==================== LISTAGEM ====================

export const list = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const actions = await prisma.launchAction.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { scheduledAt: 'desc' },
        });

        res.json({ actions });
    } catch (error) {
        console.error('[LaunchActions] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar ações' });
    }
};

// ==================== CRIAR AÇÃO ====================

export const create = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { type, config, scheduledAt, applyToAll = true, groupIds } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const validTypes = [
            'CHANGE_PHOTO',
            'CHANGE_NAME',
            'CHANGE_DESCRIPTION',
            'LOCK_MESSAGES',
            'UNLOCK_MESSAGES',
        ];

        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Tipo de ação inválido' });
        }

        if (!scheduledAt) {
            return res.status(400).json({ error: 'Data de agendamento é obrigatória' });
        }

        const action = await prisma.launchAction.create({
            data: {
                launchId: parseInt(launchId),
                type,
                config: JSON.stringify(config || {}),
                scheduledAt: new Date(scheduledAt),
                applyToAll,
                groupIds: groupIds ? JSON.stringify(groupIds) : null,
            },
        });

        console.log(`[LaunchActions] Ação ${type} agendada para ${launch.name}`);

        res.status(201).json({ action });
    } catch (error) {
        console.error('[LaunchActions] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro ao criar ação' });
    }
};

// ==================== CANCELAR AÇÃO ====================

export const cancel = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, actionId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const action = await prisma.launchAction.findFirst({
            where: { id: parseInt(actionId), launchId: parseInt(launchId) },
        });

        if (!action) {
            return res.status(404).json({ error: 'Ação não encontrada' });
        }

        if (action.status !== 'SCHEDULED') {
            return res.status(400).json({ error: 'Apenas ações agendadas podem ser canceladas' });
        }

        await prisma.launchAction.update({
            where: { id: parseInt(actionId) },
            data: { status: 'CANCELLED' },
        });

        res.json({ message: 'Ação cancelada' });
    } catch (error) {
        console.error('[LaunchActions] Erro ao cancelar:', error);
        res.status(500).json({ error: 'Erro ao cancelar ação' });
    }
};

// ==================== EXECUTAR AGORA ====================

export const executeNow = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, actionId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const action = await prisma.launchAction.findFirst({
            where: { id: parseInt(actionId), launchId: parseInt(launchId) },
        });

        if (!action) {
            return res.status(404).json({ error: 'Ação não encontrada' });
        }

        if (action.status !== 'SCHEDULED') {
            return res.status(400).json({ error: 'Apenas ações agendadas podem ser executadas' });
        }

        // Atualizar para execução imediata
        await prisma.launchAction.update({
            where: { id: parseInt(actionId) },
            data: { scheduledAt: new Date() },
        });

        res.json({ message: 'Ação será executada em breve' });
    } catch (error) {
        console.error('[LaunchActions] Erro ao executar:', error);
        res.status(500).json({ error: 'Erro ao executar ação' });
    }
};
