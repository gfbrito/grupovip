import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';
import axios from 'axios';

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

        const webhooks = await prisma.launchWebhook.findMany({
            where: { launchId: parseInt(launchId) },
            orderBy: { id: 'desc' },
            include: {
                _count: { select: { logs: true } },
            },
        });

        res.json({ webhooks });
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar webhooks' });
    }
};

// ==================== CRIAR WEBHOOK ====================

export const create = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId } = req.params;
        const userId = req.user!.id;
        const { name, url, events, headers } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        if (!name || !url || !events) {
            return res.status(400).json({ error: 'Nome, URL e eventos são obrigatórios' });
        }

        const validEvents = [
            'lead.joined',
            'lead.left',
            'lead.blocked',
            'group.full',
            'group.created',
            'message.sent',
            'message.failed',
        ];

        const eventList = Array.isArray(events) ? events : [events];
        const invalidEvents = eventList.filter((e: string) => !validEvents.includes(e));

        if (invalidEvents.length > 0) {
            return res.status(400).json({ error: `Eventos inválidos: ${invalidEvents.join(', ')}` });
        }

        const webhook = await prisma.launchWebhook.create({
            data: {
                launchId: parseInt(launchId),
                name,
                url,
                events: JSON.stringify(eventList),
                headers: headers ? JSON.stringify(headers) : null,
            },
        });

        res.status(201).json({ webhook });
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro ao criar webhook' });
    }
};

// ==================== ATUALIZAR WEBHOOK ====================

export const update = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, webhookId } = req.params;
        const userId = req.user!.id;
        const { name, url, events, headers, isActive } = req.body;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const webhook = await prisma.launchWebhook.update({
            where: { id: parseInt(webhookId) },
            data: {
                ...(name && { name }),
                ...(url && { url }),
                ...(events && { events: JSON.stringify(events) }),
                ...(headers !== undefined && { headers: headers ? JSON.stringify(headers) : null }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json({ webhook });
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao atualizar:', error);
        res.status(500).json({ error: 'Erro ao atualizar webhook' });
    }
};

// ==================== EXCLUIR WEBHOOK ====================

export const remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, webhookId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        await prisma.launchWebhook.delete({
            where: { id: parseInt(webhookId) },
        });

        res.json({ message: 'Webhook excluído' });
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao excluir:', error);
        res.status(500).json({ error: 'Erro ao excluir webhook' });
    }
};

// ==================== TESTAR WEBHOOK ====================

export const test = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, webhookId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const webhook = await prisma.launchWebhook.findFirst({
            where: { id: parseInt(webhookId), launchId: parseInt(launchId) },
        });

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook não encontrado' });
        }

        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            launch: {
                id: launch.id,
                name: launch.name,
                slug: launch.slug,
            },
            data: {
                message: 'Este é um teste do webhook',
            },
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (webhook.headers) {
            Object.assign(headers, JSON.parse(webhook.headers));
        }

        try {
            const response = await axios.post(webhook.url, testPayload, {
                headers,
                timeout: 10000,
            });

            // Registrar log
            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event: 'test',
                    payload: JSON.stringify(testPayload),
                    statusCode: response.status,
                    response: JSON.stringify(response.data).slice(0, 1000),
                    success: response.status >= 200 && response.status < 300,
                },
            });

            res.json({
                success: true,
                statusCode: response.status,
                response: response.data,
            });
        } catch (error: any) {
            // Registrar falha
            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event: 'test',
                    payload: JSON.stringify(testPayload),
                    statusCode: error.response?.status || 0,
                    response: error.message,
                    success: false,
                },
            });

            res.status(200).json({
                success: false,
                error: error.message,
                statusCode: error.response?.status,
            });
        }
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao testar:', error);
        res.status(500).json({ error: 'Erro ao testar webhook' });
    }
};

// ==================== LOGS DO WEBHOOK ====================

export const getLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: launchId, webhookId } = req.params;
        const userId = req.user!.id;

        const launch = await prisma.launch.findFirst({
            where: { id: parseInt(launchId), userId },
        });

        if (!launch) {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        const logs = await prisma.webhookOutLog.findMany({
            where: { webhookId: parseInt(webhookId) },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json({ logs });
    } catch (error) {
        console.error('[LaunchWebhooks] Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
};
