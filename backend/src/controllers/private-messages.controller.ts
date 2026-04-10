import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { privateMessagingService } from '../services/private-messaging.service';

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

        const messages = await prisma.privateMessage.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { logs: true } },
            },
        });

        res.json({ messages });
    } catch (error) {
        console.error('[PrivateMessages] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar mensagens' });
    }
};

// ==================== CRIAR MENSAGEM ====================

export const create = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { title, type, content, mediaUrl, scheduledAt, delayMin, delayMax, sendNow } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Conteúdo é obrigatório' });
        }

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        // Determinar status baseado em sendNow ou scheduledAt
        let status = 'DRAFT';
        let scheduled: Date | null = null;

        if (sendNow) {
            status = 'SENDING';
        } else if (scheduledAt) {
            scheduled = new Date(scheduledAt);
            if (scheduled <= new Date()) {
                return res.status(400).json({ error: 'Data de agendamento deve ser futura' });
            }
            status = 'SCHEDULED';
        }

        const message = await prisma.privateMessage.create({
            data: {
                launchId: parseInt(launchId),
                title,
                type: type || 'TEXT',
                content,
                mediaUrl,
                scheduledAt: scheduled,
                delayMin: delayMin || 1500,
                delayMax: delayMax || 3000,
                status,
            },
        });

        // Se for enviar agora, iniciar envio imediatamente
        if (sendNow) {
            // Executar em background
            setImmediate(() => privateMessagingService.sendToLeads(message.id, parseInt(launchId)));
        }

        res.status(201).json({
            message: sendNow
                ? 'Mensagem criada e envio iniciado!'
                : (scheduled ? 'Mensagem agendada com sucesso!' : 'Mensagem criada como rascunho.'),
            data: message,
        });
    } catch (error) {
        console.error('[PrivateMessages] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro ao criar mensagem' });
    }
};

// ==================== ENVIAR AGORA ====================

export const sendNow = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, msgId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const message = await prisma.privateMessage.findFirst({
            where: { id: parseInt(msgId), launchId: parseInt(launchId) },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        if (message.status === 'SENDING' || message.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Mensagem já foi ou está sendo enviada' });
        }

        await prisma.privateMessage.update({
            where: { id: message.id },
            data: { status: 'SENDING' },
        });

        // Executar em background
        setImmediate(() => privateMessagingService.sendToLeads(message.id, parseInt(launchId)));

        res.json({ message: 'Envio iniciado!' });
    } catch (error) {
        console.error('[PrivateMessages] Erro ao enviar:', error);
        res.status(500).json({ error: 'Erro ao iniciar envio' });
    }
};

// ==================== FUNÇÃO DE ENVIO ====================



// ==================== LOGS ====================

export const getLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, msgId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const logs = await prisma.privateMessageLog.findMany({
            where: { messageId: parseInt(msgId) },
            orderBy: { sentAt: 'desc' },
        });

        res.json({ logs });
    } catch (error) {
        console.error('[PrivateMessages] Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
};

// ==================== EXCLUIR ====================

export const remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, msgId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const message = await prisma.privateMessage.findFirst({
            where: { id: parseInt(msgId), launchId: parseInt(launchId) },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        if (message.status === 'SENDING') {
            return res.status(400).json({ error: 'Não é possível excluir mensagem em envio' });
        }

        await prisma.privateMessage.delete({
            where: { id: message.id },
        });

        res.json({ message: 'Mensagem excluída' });
    } catch (error) {
        console.error('[PrivateMessages] Erro ao excluir:', error);
        res.status(500).json({ error: 'Erro ao excluir mensagem' });
    }
};
