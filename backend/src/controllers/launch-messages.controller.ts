import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import { deleteLocalMedia } from '../utils/file';

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

        const messages = await prisma.launchMessage.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { id: 'desc' },
            include: {
                _count: { select: { logs: true } },
                logs: {
                    take: 5,
                    orderBy: { sentAt: 'desc' },
                },
            },
        });

        res.json({ messages });
    } catch (error) {
        console.error('[LaunchMessages] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar mensagens' });
    }
};

// ==================== CRIAR MENSAGEM ====================

export const create = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const {
            type = 'TEXT',
            title,
            content,
            mediaUrl,
            scheduledAt,
            applyToAll = true,
            groupIds,
            delayMin = 800,
            delayMax = 2000,
            sendNow = false,
        } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        if (!content) {
            return res.status(400).json({ error: 'Conteúdo é obrigatório' });
        }

        const validTypes = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Tipo de mensagem inválido' });
        }

        // Determinar status baseado em sendNow ou scheduledAt
        let status = 'DRAFT';
        if (sendNow) {
            status = 'SENDING';
        } else if (scheduledAt) {
            status = 'SCHEDULED';
        }

        const message = await prisma.launchMessage.create({
            data: {
                launchId: parseInt(launchId),
                title,
                type,
                content,
                mediaUrl: mediaUrl || null,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                status,
                applyToAll,
                groupIds: groupIds ? JSON.stringify(groupIds) : null,
                delayMin,
                delayMax,
            },
        });

        console.log(`[LaunchMessages] Mensagem criada para ${launch.name}${sendNow ? ' - enviando imediatamente' : ''}`);

        // Se sendNow, chamar sendNow endpoint internamente
        if (sendNow) {
            // Simular chamada ao sendNow - vai processar no worker
            // Ou podemos forçar processamento imediato
            const { whatsappProvider } = await import('../services/whatsapp-provider.service');

            // Buscar grupos
            const groups = await prisma.launchGroup.findMany({
                where: { launchId: parseInt(launchId) },
            });

            // Executar envio em background
            setImmediate(async () => {
                for (const group of groups) {
                    try {
                        // Processar variáveis
                        let finalContent = content
                            .replace(/{nome}/g, group.name)
                            .replace(/{nome_lancamento}/g, launch.name)
                            .replace(/{n}/g, '\n');

                        if (type === 'TEXT') {
                            await whatsappProvider.sendMessage(group.remoteJid, finalContent);
                        } else {
                            await whatsappProvider.sendMediaMessage(
                                group.remoteJid,
                                type.toLowerCase() as 'image' | 'video' | 'document' | 'audio',
                                mediaUrl!,
                                finalContent
                            );
                        }

                        await prisma.launchMessageLog.create({
                            data: {
                                messageId: message.id,
                                groupName: group.name,
                                groupJid: group.remoteJid,
                                status: 'SENT',
                            },
                        });

                        // Delay entre envios
                        const delay = Math.floor(Math.random() * (delayMax - delayMin) + delayMin);
                        await new Promise(r => setTimeout(r, delay));
                    } catch (error: any) {
                        await prisma.launchMessageLog.create({
                            data: {
                                messageId: message.id,
                                groupName: group.name,
                                groupJid: group.remoteJid,
                                status: 'FAILED',
                                error: error.message,
                            },
                        });
                    }
                }

                // Atualizar status final
                const logs = await prisma.launchMessageLog.findMany({
                    where: { messageId: message.id },
                });
                const failed = logs.filter(l => l.status === 'FAILED').length;

                await prisma.launchMessage.update({
                    where: { id: message.id },
                    data: {
                        status: failed === logs.length ? 'FAILED' : 'COMPLETED',
                        sentAt: new Date(),
                    },
                });

                // Limpeza: deletar media local após disparo a todos
                deleteLocalMedia(message.mediaUrl);
            });
        }

        res.status(201).json({
            message,
            info: sendNow ? 'Envio iniciado em background!' : undefined,
        });
    } catch (error) {
        console.error('[LaunchMessages] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro ao criar mensagem' });
    }
};

// ==================== ENVIAR AGORA ====================

export const sendNow = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, messageId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const message = await prisma.launchMessage.findFirst({
            where: { id: parseInt(messageId), launchId: parseInt(launchId) },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        if (message.status === 'SENDING' || message.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Mensagem já está sendo enviada ou foi enviada' });
        }

        await prisma.launchMessage.update({
            where: { id: parseInt(messageId) },
            data: {
                status: 'SCHEDULED',
                scheduledAt: new Date(),
            },
        });

        res.json({ message: 'Mensagem será enviada em breve' });
    } catch (error) {
        console.error('[LaunchMessages] Erro ao enviar:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
};

// ==================== ENVIAR TESTE ====================

export const sendTest = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, messageId } = req.params;
        const userId = req.user!.id;
        const { groupId } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const message = await prisma.launchMessage.findFirst({
            where: { id: parseInt(messageId), launchId: parseInt(launchId) },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        // Buscar grupo
        const group = await prisma.launchGroup.findFirst({
            where: {
                launchId: parseInt(launchId),
                ...(groupId ? { id: parseInt(groupId) } : {}),
            },
        });

        if (!group) {
            return res.status(400).json({ error: 'Nenhum grupo disponível para teste' });
        }

        // Importar provider e enviar
        const { whatsappProvider } = await import('../services/whatsapp-provider.service');
        const { replaceVariables } = await import('../services/message.service');

        const finalContent = replaceVariables(message.content, group.name);

        if (message.type === 'TEXT') {
            await whatsappProvider.sendMessage(group.remoteJid, finalContent);
        } else {
            // Para outros tipos, enviar com mídia
            await whatsappProvider.sendMediaMessage(
                group.remoteJid,
                message.type.toLowerCase() as 'image' | 'video' | 'document' | 'audio',
                message.mediaUrl!,
                finalContent
            );
        }

        res.json({ message: 'Mensagem de teste enviada', groupName: group.name });
    } catch (error: any) {
        console.error('[LaunchMessages] Erro ao enviar teste:', error);
        res.status(500).json({ error: error.message || 'Erro ao enviar mensagem de teste' });
    }
};

// ==================== LOGS DA MENSAGEM ====================

export const getLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, messageId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const logs = await prisma.launchMessageLog.findMany({
            where: { messageId: parseInt(messageId) },
            orderBy: { sentAt: 'desc' },
        });

        res.json({ logs });
    } catch (error) {
        console.error('[LaunchMessages] Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
};

// ==================== EXCLUIR MENSAGEM ====================

export const remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, messageId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const message = await prisma.launchMessage.findFirst({
            where: { id: parseInt(messageId), launchId: parseInt(launchId) },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        if (message.status === 'SENDING') {
            return res.status(400).json({ error: 'Não é possível excluir mensagem em envio' });
        }

        await prisma.launchMessage.delete({
            where: { id: parseInt(messageId) },
        });

        // Cleanup da mídia física local (se existir)
        deleteLocalMedia(message.mediaUrl);

        res.json({ message: 'Mensagem excluída' });
    } catch (error) {
        console.error('[LaunchMessages] Erro ao excluir:', error);
        res.status(500).json({ error: 'Erro ao excluir mensagem' });
    }
};
