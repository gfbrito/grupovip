import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { createAIProvider, AIContext } from '../services/ai.service';
import { whatsappProvider } from '../services/whatsapp-provider.service';

// ==================== LISTAR MENSAGENS ====================

export const list = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, limit = 50 } = req.query;

        const where: any = { launchId: parseInt(id) };
        if (status) where.status = status;

        const messages = await prisma.leadMessage.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
            take: Number(limit),
            include: {
                lead: { select: { id: true, phone: true, name: true } },
            },
        });

        const stats = await prisma.leadMessage.groupBy({
            by: ['status'],
            where: { launchId: parseInt(id) },
            _count: true,
        });

        res.json({ messages, stats });
    } catch (error) {
        console.error('[LeadMessages] Erro ao listar:', error);
        res.status(500).json({ error: 'Erro ao listar mensagens' });
    }
};

// ==================== APROVAR E ENVIAR ====================

export const approve = async (req: Request, res: Response) => {
    try {
        const { id, messageId } = req.params;
        const { reply } = req.body;
        const userId = (req as any).user?.id;

        const message = await prisma.leadMessage.findFirst({
            where: { id: parseInt(messageId), launchId: parseInt(id) },
        });

        if (!message) {
            res.status(404).json({ error: 'Mensagem não encontrada' });
            return;
        }

        const replyText = reply || message.aiSuggestion;
        if (!replyText) {
            res.status(400).json({ error: 'Nenhuma resposta para enviar' });
            return;
        }

        // Enviar mensagem via WhatsApp
        try {
            await whatsappProvider.sendMessage(message.groupJid, replyText);
        } catch (err: any) {
            res.status(500).json({ error: `Erro ao enviar: ${err.message}` });
            return;
        }

        // Atualizar status
        const updated = await prisma.leadMessage.update({
            where: { id: parseInt(messageId) },
            data: {
                status: 'SENT',
                reply: replyText,
                repliedAt: new Date(),
                repliedBy: userId,
            },
        });

        res.json({ message: updated, sent: true });
    } catch (error) {
        console.error('[LeadMessages] Erro ao aprovar:', error);
        res.status(500).json({ error: 'Erro ao aprovar mensagem' });
    }
};

// ==================== REJEITAR ====================

export const reject = async (req: Request, res: Response) => {
    try {
        const { id, messageId } = req.params;

        const updated = await prisma.leadMessage.update({
            where: { id: parseInt(messageId) },
            data: { status: 'REJECTED' },
        });

        res.json({ message: updated });
    } catch (error) {
        console.error('[LeadMessages] Erro ao rejeitar:', error);
        res.status(500).json({ error: 'Erro ao rejeitar mensagem' });
    }
};

// ==================== IGNORAR ====================

export const ignore = async (req: Request, res: Response) => {
    try {
        const { id, messageId } = req.params;

        const updated = await prisma.leadMessage.update({
            where: { id: parseInt(messageId) },
            data: { status: 'IGNORED' },
        });

        res.json({ message: updated });
    } catch (error) {
        console.error('[LeadMessages] Erro ao ignorar:', error);
        res.status(500).json({ error: 'Erro ao ignorar mensagem' });
    }
};

// ==================== REGENERAR SUGESTÃO ====================

export const regenerate = async (req: Request, res: Response) => {
    try {
        const { id, messageId } = req.params;

        const message = await prisma.leadMessage.findFirst({
            where: { id: parseInt(messageId), launchId: parseInt(id) },
            include: {
                launch: { include: { aiConfig: true } },
                lead: true,
            },
        });

        if (!message) {
            res.status(404).json({ error: 'Mensagem não encontrada' });
            return;
        }

        const { AICreditsService } = await import('../services/ai-credits.service');
        try {
            await AICreditsService.checkCredits(message.launch.userId, 1);
        } catch (err: any) {
            res.status(402).json({ error: 'Saldo de créditos de IA insuficiente.' });
            return;
        }

        // Buscar config global de IA
        const globalAIConfig = await prisma.aIConfig.findUnique({ where: { id: 1 } });

        if (!globalAIConfig?.apiKey) {
            res.status(400).json({ error: 'IA não configurada. Configure em Configurações.' });
            return;
        }

        const aiProvider = createAIProvider(
            globalAIConfig.provider as 'OPENAI' | 'GEMINI',
            globalAIConfig.apiKey,
            globalAIConfig.model
        );

        // Prompt: usa do lançamento se existir, senão usa global
        const launchPrompt = message.launch.aiConfig?.systemPrompt;
        const systemPrompt = launchPrompt || globalAIConfig.systemPrompt || undefined;

        const context: AIContext = {
            launchName: message.launch.name,
            leadName: message.lead?.name || undefined,
            systemPrompt,
        };

        const aiResponse = await aiProvider.generateResponse(message.content, context);

        const updated = await prisma.leadMessage.update({
            where: { id: parseInt(messageId) },
            data: {
                aiSuggestion: aiResponse.suggestion,
                aiConfidence: aiResponse.confidence,
                aiCategory: aiResponse.category,
            },
        });

        // Consumir créditos
        await AICreditsService.consumeCredits(
            message.launch.userId,
            'REGENERATE_REPLY',
            1, // Custo fixo
            globalAIConfig.model || 'unknown',
            message.id,
            'LeadMessage'
        );

        res.json({ message: updated, aiResponse });
    } catch (error) {
        console.error('[LeadMessages] Erro ao regenerar:', error);
        res.status(500).json({ error: 'Erro ao regenerar sugestão' });
    }
};

// ==================== CONFIGURAÇÃO GLOBAL DE IA ====================

export const getAIConfig = async (req: Request, res: Response) => {
    try {
        const config = await prisma.aIConfig.findUnique({ where: { id: 1 } });

        // Mascarar API key
        if (config?.apiKey) {
            const masked = config.apiKey.slice(0, 4) + '***' + config.apiKey.slice(-4);
            res.json({ config: { ...config, apiKey: masked, hasApiKey: true } });
        } else {
            res.json({ config: config || { isEnabled: false, provider: 'OPENAI', model: 'gpt-4o-mini' } });
        }
    } catch (error) {
        console.error('[AI] Erro ao buscar config:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
};

export const updateAIConfig = async (req: Request, res: Response) => {
    try {
        const { isEnabled, provider, apiKey, model, systemPrompt } = req.body;

        const data: any = {};
        if (isEnabled !== undefined) data.isEnabled = isEnabled;
        if (provider) data.provider = provider;
        if (apiKey) data.apiKey = apiKey;
        if (model) data.model = model;
        if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;

        const config = await prisma.aIConfig.upsert({
            where: { id: 1 },
            update: data,
            create: { id: 1, ...data },
        });

        res.json({ config: { ...config, apiKey: config.apiKey ? '***' : null } });
    } catch (error) {
        console.error('[AI] Erro ao atualizar config:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
};

// ==================== ESTATÍSTICAS ====================

export const getStats = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [total, pending, sent, rejected] = await Promise.all([
            prisma.leadMessage.count({ where: { launchId: parseInt(id) } }),
            prisma.leadMessage.count({ where: { launchId: parseInt(id), status: 'PENDING' } }),
            prisma.leadMessage.count({ where: { launchId: parseInt(id), status: 'SENT' } }),
            prisma.leadMessage.count({ where: { launchId: parseInt(id), status: 'REJECTED' } }),
        ]);

        const byCategory = await prisma.leadMessage.groupBy({
            by: ['aiCategory'],
            where: { launchId: parseInt(id), aiCategory: { not: null } },
            _count: true,
        });

        res.json({ total, pending, sent, rejected, byCategory });
    } catch (error) {
        console.error('[LeadMessages] Erro ao buscar stats:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
};

// ==================== CONFIG DE IA POR LANÇAMENTO ====================

export const getLaunchAIConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const config = await prisma.launchAIConfig.findUnique({
            where: { launchId: parseInt(id) },
        });

        res.json({ config: config || { isEnabled: true, autoReply: false, systemPrompt: '' } });
    } catch (error) {
        console.error('[AI] Erro ao buscar config launch:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
};

export const updateLaunchAIConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isEnabled, autoReply, systemPrompt } = req.body;

        const data: any = {};
        if (isEnabled !== undefined) data.isEnabled = isEnabled;
        if (autoReply !== undefined) data.autoReply = autoReply;
        if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;

        const config = await prisma.launchAIConfig.upsert({
            where: { launchId: parseInt(id) },
            update: data,
            create: { launchId: parseInt(id), ...data },
        });

        res.json({ config });
    } catch (error) {
        console.error('[AI] Erro ao atualizar config launch:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
};
