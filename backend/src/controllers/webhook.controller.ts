import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { leadScoringService } from '../services/lead-scoring.service';

// ==================== CONFIG GLOBAL ====================

export const getConfig = async (req: Request, res: Response) => {
    try {
        let config = await prisma.webhookConfig.findUnique({ where: { id: 1 } });

        if (!config) {
            config = await prisma.webhookConfig.create({
                data: { id: 1, secretToken: uuidv4() },
            });
        }

        // Gerar URL do webhook
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const webhookUrl = `${baseUrl}/api/webhooks/evolution`;

        res.json({
            config: {
                ...config,
                webhookUrl,
                evolutionConfig: {
                    url: webhookUrl,
                    headers: {
                        'x-webhook-token': config.secretToken,
                    },
                    events: [
                        'GROUP_PARTICIPANTS_UPDATE',
                        'GROUPS_UPDATE',
                    ],
                },
            },
        });
    } catch (error) {
        console.error('[Webhook] Erro ao buscar config:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
};

// ==================== REGENERAR TOKEN ====================

export const regenerateToken = async (req: Request, res: Response) => {
    try {
        const newToken = uuidv4();

        await prisma.webhookConfig.upsert({
            where: { id: 1 },
            create: { id: 1, secretToken: newToken },
            update: { secretToken: newToken },
        });

        res.json({ token: newToken, message: 'Token regenerado com sucesso' });
    } catch (error) {
        console.error('[Webhook] Erro ao regenerar token:', error);
        res.status(500).json({ error: 'Erro ao regenerar token' });
    }
};

// ==================== TOGGLE WEBHOOK ====================

export const toggle = async (req: Request, res: Response) => {
    try {
        const config = await prisma.webhookConfig.findUnique({ where: { id: 1 } });

        if (!config) {
            return res.status(404).json({ error: 'Configuração não encontrada' });
        }

        await prisma.webhookConfig.update({
            where: { id: 1 },
            data: { isActive: !config.isActive },
        });

        res.json({
            isActive: !config.isActive,
            message: !config.isActive ? 'Webhook ativado' : 'Webhook desativado',
        });
    } catch (error) {
        console.error('[Webhook] Erro ao alternar:', error);
        res.status(500).json({ error: 'Erro ao alternar webhook' });
    }
};

// ==================== LOGS RECENTES ====================

export const getLogs = async (req: Request, res: Response) => {
    try {
        const { limit = '50' } = req.query;

        const logs = await prisma.webhookLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
        });

        res.json({ logs });
    } catch (error) {
        console.error('[Webhook] Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
};

// ==================== RECEBER WEBHOOK DA EVOLUTION ====================

export const handleEvolution = async (req: Request, res: Response) => {
    try {
        const token = req.headers['x-webhook-token'] as string;
        const event = req.body.event || req.headers['x-webhook-event'];
        const payload = req.body;

        // Buscar config
        const config = await prisma.webhookConfig.findUnique({ where: { id: 1 } });

        // Validar token
        if (config && config.secretToken !== token) {
            console.log('[Webhook] Token inválido recebido');
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se está ativo
        if (config && !config.isActive) {
            return res.status(200).json({ message: 'Webhook desativado' });
        }

        // Registrar log
        const log = await prisma.webhookLog.create({
            data: {
                event: event || 'unknown',
                payload: JSON.stringify(payload),
            },
        });

        console.log(`[Webhook] Recebido evento: ${event}`);

        // Processar evento
        try {
            await processWebhookEvent(event, payload, log.id);
        } catch (err: any) {
            await prisma.webhookLog.update({
                where: { id: log.id },
                data: { error: err.message },
            });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('[Webhook] Erro ao processar:', error);
        res.status(500).json({ error: 'Erro ao processar webhook' });
    }
};

// ==================== PROCESSAMENTO DE EVENTOS ====================

async function processWebhookEvent(event: string, payload: any, logId: number) {
    const data = payload.data || payload;

    switch (event) {
        case 'GROUP_PARTICIPANTS_UPDATE':
        case 'group-participants.update':
            await handleParticipantsUpdate(data, logId);
            break;

        case 'GROUPS_UPDATE':
        case 'groups.update':
            await handleGroupsUpdate(data, logId);
            break;

        case 'MESSAGES_UPSERT':
        case 'messages.upsert':
            await handleMessagesUpsert(data, logId, payload.instance || 'default');
            break;

        default:
            console.log(`[Webhook] Evento não tratado: ${event}`);
    }
}

async function handleParticipantsUpdate(data: any, logId: number) {
    const { id: remoteJid, participants, action } = data;

    if (!remoteJid || !participants || !action) {
        console.log('[Webhook] Dados incompletos para participants update');
        return;
    }

    // Encontrar grupo do lançamento
    const launchGroup = await prisma.launchGroup.findUnique({
        where: { remoteJid },
        include: { launch: true },
    });

    if (!launchGroup) {
        console.log(`[Webhook] Grupo ${remoteJid} não está vinculado a nenhum lançamento`);
        return;
    }

    // Atualizar log com launchId
    await prisma.webhookLog.update({
        where: { id: logId },
        data: { launchId: launchGroup.launchId, processed: true },
    });

    for (const participant of participants) {
        const phone = participant.replace('@s.whatsapp.net', '').replace('@c.us', '');

        if (action === 'add') {
            // Lead entrou no grupo
            await handleLeadJoined(launchGroup, phone);
        } else if (action === 'remove') {
            // Lead saiu do grupo
            await handleLeadLeft(launchGroup, phone);
        }
    }

    // Atualizar contagem de membros
    const currentCount = await prisma.launchLeadGroup.count({
        where: { groupId: launchGroup.id, isActive: true },
    });

    await prisma.launchGroup.update({
        where: { id: launchGroup.id },
        data: { memberCount: currentCount + 1, syncedAt: new Date() }, // +1 para contar o admin
    });
}

async function handleLeadJoined(launchGroup: any, phone: string) {
    // Buscar ou criar lead
    let lead = await prisma.launchLead.findUnique({
        where: {
            launchId_phone: {
                launchId: launchGroup.launchId,
                phone,
            },
        },
    });

    if (!lead) {
        lead = await prisma.launchLead.create({
            data: {
                launchId: launchGroup.launchId,
                phone,
            },
        });
    } else {
        await prisma.launchLead.update({
            where: { id: lead.id },
            data: { lastSeenAt: new Date() },
        });
    }

    // Registrar entrada no grupo
    await prisma.launchLeadGroup.upsert({
        where: {
            leadId_groupId: {
                leadId: lead.id,
                groupId: launchGroup.id,
            },
        },
        create: {
            leadId: lead.id,
            groupId: launchGroup.id,
        },
        update: {
            isActive: true,
            joinedAt: new Date(),
            leftAt: null,
        },
    });

    // Marcar clique como convertido se houver
    await prisma.launchClick.updateMany({
        where: {
            launchId: launchGroup.launchId,
            leadId: lead.id,
            converted: false,
        },
        data: { converted: true },
    });

    // Disparar webhooks de saída
    await triggerOutgoingWebhooks(launchGroup.launchId, 'lead.joined', {
        phone,
        groupId: launchGroup.id,
        groupName: launchGroup.name,
    });



    // Lead Scoring: +10 pontos
    await leadScoringService.trackEvent(
        launchGroup.launchId,
        lead.id,
        'GROUP_JOIN',
        `Entrou no grupo ${launchGroup.name}`
    );

    console.log(`[Webhook] Lead ${phone} entrou no grupo ${launchGroup.name}`);
}

async function handleLeadLeft(launchGroup: any, phone: string) {
    // Buscar lead
    const lead = await prisma.launchLead.findUnique({
        where: {
            launchId_phone: {
                launchId: launchGroup.launchId,
                phone,
            },
        },
    });

    if (!lead) return;

    // Marcar saída
    await prisma.launchLeadGroup.updateMany({
        where: {
            leadId: lead.id,
            groupId: launchGroup.id,
        },
        data: {
            isActive: false,
            leftAt: new Date(),
        },
    });

    // Disparar webhooks de saída
    await triggerOutgoingWebhooks(launchGroup.launchId, 'lead.left', {
        phone,
        groupId: launchGroup.id,
        groupName: launchGroup.name,
    });



    // Lead Scoring: -5 pontos
    await leadScoringService.trackEvent(
        launchGroup.launchId,
        lead.id,
        'GROUP_LEAVE',
        `Saiu do grupo ${launchGroup.name}`
    );

    console.log(`[Webhook] Lead ${phone} saiu do grupo ${launchGroup.name}`);
}

async function handleGroupsUpdate(data: any, logId: number) {
    const { id: remoteJid, subject, size } = data;

    if (!remoteJid) return;

    // Atualizar grupo se existir
    const launchGroup = await prisma.launchGroup.findUnique({
        where: { remoteJid },
    });

    if (!launchGroup) return;

    await prisma.webhookLog.update({
        where: { id: logId },
        data: { launchId: launchGroup.launchId, processed: true },
    });

    await prisma.launchGroup.update({
        where: { id: launchGroup.id },
        data: {
            ...(subject && { name: subject }),
            ...(size && { memberCount: size }),
            syncedAt: new Date(),
        },
    });

    console.log(`[Webhook] Grupo ${launchGroup.name} atualizado`);
}

// ==================== PROCESSAR MENSAGENS RECEBIDAS ====================

async function handleMessagesUpsert(data: any, logId: number, provider: string) {
    // Formato Evolution API: data.key.remoteJid, data.message
    // Pode vir como array ou objeto único
    const messages = Array.isArray(data) ? data : [data];

    for (const msg of messages) {
        const key = msg.key || {};
        const remoteJid = key.remoteJid;
        const fromMe = key.fromMe;
        const participant = key.participant; // Quem enviou em grupos

        // Ignorar mensagens próprias
        if (fromMe) continue;

        // Ignorar mensagens que não são de grupo
        if (!remoteJid || !remoteJid.includes('@g.us')) continue;

        // Buscar grupo do lançamento
        const launchGroup = await prisma.launchGroup.findUnique({
            where: { remoteJid },
            include: { launch: { include: { aiConfig: true } } },
        });

        if (!launchGroup) {
            console.log(`[Webhook] Mensagem de grupo não vinculado: ${remoteJid}`);
            continue;
        }

        // Verificar se IA está habilitada
        if (!launchGroup.launch.aiConfig?.isEnabled) {
            console.log(`[Webhook] IA desabilitada para lançamento ${launchGroup.launch.name}`);
            continue;
        }

        // Extrair conteúdo da mensagem
        const messageContent = msg.message || {};
        let content = '';
        let mediaType = 'TEXT';
        let mediaUrl = null;

        if (messageContent.conversation) {
            content = messageContent.conversation;
        } else if (messageContent.extendedTextMessage) {
            content = messageContent.extendedTextMessage.text || '';
        } else if (messageContent.imageMessage) {
            content = messageContent.imageMessage.caption || '[Imagem]';
            mediaType = 'IMAGE';
        } else if (messageContent.videoMessage) {
            content = messageContent.videoMessage.caption || '[Vídeo]';
            mediaType = 'VIDEO';
        } else if (messageContent.audioMessage) {
            content = '[Áudio]';
            mediaType = 'AUDIO';
        } else if (messageContent.documentMessage) {
            content = messageContent.documentMessage.fileName || '[Documento]';
            mediaType = 'DOCUMENT';
        } else {
            // Tipo não suportado
            continue;
        }

        // Extrair telefone do remetente
        const phone = (participant || remoteJid).replace('@s.whatsapp.net', '').replace('@c.us', '').split('@')[0];

        // Buscar ou criar lead
        let lead = await prisma.launchLead.findUnique({
            where: {
                launchId_phone: {
                    launchId: launchGroup.launchId,
                    phone,
                },
            },
        });

        if (!lead) {
            lead = await prisma.launchLead.create({
                data: {
                    launchId: launchGroup.launchId,
                    phone,
                },
            });
        }

        // Salvar mensagem
        const leadMessage = await prisma.leadMessage.create({
            data: {
                content,
                mediaType,
                mediaUrl,
                fromPhone: phone,
                groupJid: remoteJid,
                provider,
                launchId: launchGroup.launchId,
                leadId: lead.id,
            },
        });

        console.log(`[Webhook] Mensagem salva de ${phone}: "${content.slice(0, 50)}..."`);

        // Gerar sugestão com IA (async, não bloquear webhook)
        generateAISuggestion(leadMessage.id, launchGroup.launch).catch(err => {
            console.error('[Webhook] Erro ao gerar sugestão IA:', err.message);
        });

        // Lead Scoring: +3 ou +5 (se for pergunta)
        const isQuestion = content.includes('?');
        await leadScoringService.trackEvent(
            launchGroup.launchId,
            lead.id,
            isQuestion ? 'MESSAGE_QUESTION' : 'MESSAGE_SENT',
            isQuestion ? 'Enviou pergunta no grupo' : 'Enviou mensagem no grupo',
            { messageId: leadMessage.id, groupJid: remoteJid }
        );
    }

    // Atualizar log
    await prisma.webhookLog.update({
        where: { id: logId },
        data: { processed: true },
    });
}

// Função auxiliar para gerar sugestão com IA
async function generateAISuggestion(messageId: number, launch: any) {
    const aiConfig = launch.aiConfig;
    if (!aiConfig?.apiKey) return;

    const message = await prisma.leadMessage.findUnique({
        where: { id: messageId },
        include: { lead: true },
    });

    if (!message) return;

    try {
        const { createAIProvider } = await import('../services/ai.service');
        type AIContext = import('../services/ai.service').AIContext;

        const aiProvider = createAIProvider(
            aiConfig.provider as 'OPENAI' | 'GEMINI',
            aiConfig.apiKey,
            aiConfig.model
        );

        const { AICreditsService } = await import('../services/ai-credits.service');
        try {
            await AICreditsService.checkCredits(launch.userId, 1);
        } catch (err: any) {
            console.error(`[IA] Usuário ${launch.userId} sem saldo de IA.`);
            return;
        }

        const context: AIContext = {
            launchName: launch.name,
            leadName: message.lead?.name || undefined,
            systemPrompt: aiConfig.systemPrompt || undefined,
        };

        const aiResponse = await aiProvider.generateResponse(message.content, context);

        await prisma.leadMessage.update({
            where: { id: messageId },
            data: {
                aiSuggestion: aiResponse.suggestion,
                aiConfidence: aiResponse.confidence,
                aiCategory: aiResponse.category,
            },
        });

        // Consumir créditos
        await AICreditsService.consumeCredits(
            launch.userId,
            'LEAD_REPLY',
            1, // Custo fixo
            aiConfig.model || 'unknown',
            message.id,
            'LeadMessage'
        );

        // Se modo automático, enviar resposta
        if (aiConfig.autoReply && aiResponse.confidence >= 0.7) {
            const { whatsappProvider } = await import('../services/whatsapp-provider.service');
            await whatsappProvider.sendMessage(message.groupJid, aiResponse.suggestion);

            await prisma.leadMessage.update({
                where: { id: messageId },
                data: {
                    status: 'SENT',
                    reply: aiResponse.suggestion,
                    repliedAt: new Date(),
                },
            });

            console.log(`[IA] Resposta automática enviada para ${message.fromPhone}`);
        }
    } catch (error: any) {
        console.error(`[IA] Erro ao processar mensagem ${messageId}:`, error.message);
    }
}

// ==================== TRIGGER WEBHOOKS DE SAÍDA ====================

async function triggerOutgoingWebhooks(launchId: number, event: string, data: any) {
    const webhooks = await prisma.launchWebhook.findMany({
        where: {
            launchId,
            isActive: true,
        },
    });

    const launch = await prisma.launch.findUnique({
        where: { id: launchId },
    });

    for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events) as string[];
        if (!events.includes(event)) continue;

        const payload = {
            event,
            timestamp: new Date().toISOString(),
            launch: {
                id: launchId,
                name: launch?.name,
                slug: launch?.slug,
            },
            data,
        };

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (webhook.headers) {
                Object.assign(headers, JSON.parse(webhook.headers));
            }

            const axios = (await import('axios')).default;
            const response = await axios.post(webhook.url, payload, {
                headers,
                timeout: 10000,
            });

            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event,
                    payload: JSON.stringify(payload),
                    statusCode: response.status,
                    response: JSON.stringify(response.data).slice(0, 1000),
                    success: true,
                },
            });
        } catch (error: any) {
            await prisma.webhookOutLog.create({
                data: {
                    webhookId: webhook.id,
                    event,
                    payload: JSON.stringify(payload),
                    statusCode: error.response?.status || 0,
                    response: error.message,
                    success: false,
                },
            });
        }
    }
}
