/**
 * Controller para gerenciar servidores WhatsApp
 */

import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { whatsappProvider } from '../services/whatsapp-provider.service';
import { BaileysProvider } from '../services/providers/baileys.provider';

/**
 * Mascara a API key mantendo apenas os últimos 4 caracteres
 */
function maskApiKey(key: string | null | undefined): string | null {
    if (!key || key.length < 8) return key ? '****' : null;
    return `****${key.slice(-4)}`;
}

/**
 * GET /api/whatsapp-servers
 * Lista todos os servidores WhatsApp
 */
export async function listServers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = (req.user as any).id;
        const isAdmin = (req.user as any).role === 'ADMIN';
        const isMaster = (req.user as any).role === 'MASTER';

        // Filtro por usuário se não for MASTER/ADMIN
        const where = !isMaster && !isAdmin ? { userId } : {};

        const servers = await prisma.whatsAppServer.findMany({
            where,
            orderBy: { priority: 'asc' },
        });

        const maskedServers = servers.map(s => {
            if (!isMaster) {
                const { url, apiKey, ...rest } = s as any;
                return rest;
            }
            return {
                ...s,
                apiKey: maskApiKey(s.apiKey),
            };
        });

        // Buscar estatísticas
        const activeCount = servers.filter(s => s.isActive).length;
        const hasBaileys = servers.some(s => s.type === 'BAILEYS' && s.isActive);
        const hasEvolution = servers.some(s => s.type === 'EVOLUTION' && s.isActive);
        const hasWebjs = servers.some(s => s.type === 'WEBJS' && s.isActive);

        res.json({
            servers: maskedServers,
            stats: {
                total: servers.length,
                active: activeCount,
                hasBaileys,
                hasEvolution,
                hasWebjs,
            },
            warnings: !hasEvolution ? ['Recomenda-se ter pelo menos um servidor Evolution como backup'] : [],
        });
    } catch (error) {
        console.error('Erro ao listar servidores:', error);
        res.status(500).json({ error: 'Erro ao listar servidores' });
    }
}

/**
 * GET /api/whatsapp-servers/:id
 * Busca um servidor específico
 */
export async function getServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const server = await prisma.whatsAppServer.findUnique({
            where: { id: parseInt(id) },
        });

        if (!server) {
            res.status(404).json({ error: 'Servidor não encontrado' });
            return;
        }

        // Verificar posse se não for MASTER/ADMIN
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';
        const isAdmin = (req.user as any).role === 'ADMIN';

        if (!isMaster && !isAdmin && server.userId !== userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        if (!isMaster) {
            const { url, apiKey, ...rest } = server as any;
            res.json(rest);
            return;
        }

        res.json({
            ...server,
            apiKey: maskApiKey(server.apiKey),
        });
    } catch (error) {
        console.error('Erro ao buscar servidor:', error);
        res.status(500).json({ error: 'Erro ao buscar servidor' });
    }
}

/**
 * POST /api/whatsapp-servers
 * Adiciona novo servidor
 */
export async function createServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { name, type, instanceName } = req.body;
        let { url, apiKey } = req.body;
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';

        // Validações básicas
        if (!name || !type) {
            res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
            return;
        }

        if (!['BAILEYS', 'EVOLUTION', 'WEBJS'].includes(type)) {
            res.status(400).json({ error: 'Tipo inválido. Use: BAILEYS, EVOLUTION ou WEBJS' });
            return;
        }

        // Se for CLIENTE (não Master), herda configurações globais da Evolution
        if (!isMaster && type === 'EVOLUTION') {
            let config = await prisma.appConfig.findUnique({ where: { id: 1 } });
            if (!config) {
                config = await prisma.appConfig.findFirst();
            }
            // Heurística fail-safe: se tem URL e Key, consideramos configurado
            const actuallyConfigured = config?.isConfigured || (!!config?.evolutionUrl && !!config?.evolutionKey);

            if (!config || !actuallyConfigured) {
                res.status(503).json({
                    error: 'Sistema em manutenção',
                    message: 'Estamos passando por uma instabilidade no servidor, nossa equipe já está trabalhando para resolver.',
                    code: 'SYSTEM_UNCONFIGURED'
                });
                return;
            }
            url = config.evolutionUrl;
            apiKey = config.evolutionKey;
            
            if (!instanceName) {
                res.status(400).json({ error: 'O nome da instância é obrigatório' });
                return;
            }
        } else if (!isMaster && type === 'BAILEYS') {
            // Se for Baileys e cliente, usa a URL do próprio backend
            url = process.env.BASE_URL || 'http://localhost:3001';
        }

        if (!url) {
            res.status(400).json({ error: 'A URL do servidor é obrigatória' });
            return;
        }

        // Validar URL
        try {
            new URL(url);
        } catch {
            res.status(400).json({ error: 'URL inválida' });
            return;
        }

        // Verificar limite do plano se não for MASTER
        if (!isMaster) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { plan: true }
            });
            
            const serverCount = await prisma.whatsAppServer.count({
                where: { userId }
            });

            const maxServers = user?.plan?.maxWhatsAppServers || 1;
            if (serverCount >= maxServers) {
                res.status(403).json({ 
                    error: 'Limite do plano atingido',
                    message: `Seu plano atual permite apenas ${maxServers} conexão(ões). Faça um upgrade para adicionar mais.`
                });
                return;
            }
        }

        // Encontrar próxima prioridade
        const maxPriority = await prisma.whatsAppServer.aggregate({
            _max: { priority: true },
        });
        const nextPriority = (maxPriority._max.priority || 0) + 1;

        const server = await prisma.whatsAppServer.create({
            data: {
                name,
                type,
                url: url.replace(/\/+$/, ''),
                apiKey,
                instanceName,
                priority: nextPriority,
                isActive: false,
                status: 'PENDING',
                userId,
            },
        });

        // Se for Evolution, já tenta criar a instância remotamente
        if (type === 'EVOLUTION') {
            try {
                const { evolutionClient } = await import('../services/evolution.client');
                await evolutionClient.createInstance(instanceName);
                console.log(`[WhatsApp] Instância Evolution criada: ${instanceName}`);
            } catch (err: any) {
                console.error(`[WhatsApp] Erro ao criar instância na Evolution:`, err.message);
                // Não barramos a criação no banco local se a API falhar, 
                // o usuário pode tentar novamente via teste de conexão
            }
        }

        res.status(201).json({
            message: 'Servidor criado. Teste a conexão para ativá-lo.',
            server: { ...server, apiKey: maskApiKey(server.apiKey) },
        });
    } catch (error) {
        console.error('Erro ao criar servidor:', error);
        res.status(500).json({ error: 'Erro ao criar servidor' });
    }
}

/**
 * PUT /api/whatsapp-servers/:id
 * Atualiza servidor existente
 */
export async function updateServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { name, url, apiKey, instanceName, priority } = req.body;
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';

        const server = await prisma.whatsAppServer.findUnique({
            where: { id: parseInt(id) },
        });

        if (!server) {
            res.status(404).json({ error: 'Servidor não encontrado' });
            return;
        }

        // Verificar posse
        if (!isMaster && server.userId !== userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        // Se não for Master, não pode alterar URL ou API Key (pois são herdadas ou fixas)
        if (!isMaster && (url || apiKey)) {
            res.status(403).json({ error: 'Você não tem permissão para alterar as configurações de infraestrutura' });
            return;
        }

        // Validar URL se fornecida (apenas Master chega aqui)
        if (url) {
            try {
                new URL(url);
            } catch {
                res.status(400).json({ error: 'URL inválida' });
                return;
            }
        }

        const updated = await prisma.whatsAppServer.update({
            where: { id: parseInt(id) },
            data: {
                name: name || server.name,
                url: url ? url.replace(/\/+$/, '') : server.url,
                apiKey: apiKey !== undefined ? apiKey : server.apiKey,
                instanceName: instanceName !== undefined ? instanceName : server.instanceName,
                priority: priority !== undefined ? priority : server.priority,
                // Se alterou configuração, marcar como pendente de teste
                status: (url || apiKey || instanceName) ? 'PENDING' : server.status,
                isActive: (url || apiKey || instanceName) ? false : server.isActive,
            },
        });

        res.json({
            message: 'Servidor atualizado',
            server: { ...updated, apiKey: maskApiKey(updated.apiKey) },
        });
    } catch (error) {
        console.error('Erro ao atualizar servidor:', error);
        res.status(500).json({ error: 'Erro ao atualizar servidor' });
    }
}

/**
 * DELETE /api/whatsapp-servers/:id
 * Remove servidor
 */
export async function deleteServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const server = await prisma.whatsAppServer.findUnique({
            where: { id: parseInt(id) },
        });

        if (!server) {
            res.status(404).json({ error: 'Servidor não encontrado' });
            return;
        }

        // Verificar posse
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';
        if (!isMaster && server.userId !== userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        await prisma.whatsAppServer.delete({
            where: { id: parseInt(id) },
        });

        res.json({ message: 'Servidor removido' });
    } catch (error) {
        console.error('Erro ao remover servidor:', error);
        res.status(500).json({ error: 'Erro ao remover servidor' });
    }
}

/**
 * POST /api/whatsapp-servers/:id/test
 * Testa conexão com o servidor
 */
export async function testServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { url, apiKey, instanceName } = req.body;

        // Se não passou dados no body, busca do banco
        let serverConfig = { url, apiKey, instanceName, type: 'EVOLUTION' };

        if (!url && id) {
            const server = await prisma.whatsAppServer.findUnique({
                where: { id: parseInt(id) },
            });

            if (!server) {
                res.status(404).json({ error: 'Servidor não encontrado' });
                return;
            }

            // Verificar posse
            const userId = (req.user as any).id;
            const isMaster = (req.user as any).role === 'MASTER';
            if (!isMaster && server.userId !== userId) {
                res.status(403).json({ error: 'Acesso negado' });
                return;
            }

            serverConfig = {
                url: server.url,
                apiKey: server.apiKey || '',
                instanceName: server.instanceName || '',
                type: server.type,
            };
        }

        if (!serverConfig.url) {
            res.status(400).json({ success: false, message: 'URL é obrigatória' });
            return;
        }

        const cleanUrl = serverConfig.url.replace(/\/+$/, '');

        // Testar conexão baseado no tipo
        if (serverConfig.type === 'EVOLUTION') {
            if (!serverConfig.apiKey || !serverConfig.instanceName) {
                res.status(400).json({ success: false, message: 'API Key e Instance Name são obrigatórios para Evolution' });
                return;
            }

            const response = await axios.get(
                `${cleanUrl}/instance/connectionState/${serverConfig.instanceName}`,
                {
                    headers: { apikey: serverConfig.apiKey },
                    timeout: 10000,
                }
            );

            const state = response.data?.instance?.state || response.data?.state;

            // Atualizar status no banco
            if (id) {
                await prisma.whatsAppServer.update({
                    where: { id: parseInt(id) },
                    data: {
                        status: state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
                        lastCheck: new Date(),
                        lastError: null,
                    },
                });
            }

            res.json({
                success: true,
                state,
                message: state === 'open' ? 'Conectado!' : 'API conectada, mas instância desconectada',
            });
        } else {
            // Para Baileys e Web.js, testar endpoint básico
            const response = await axios.get(`${cleanUrl}/status`, { timeout: 10000 });

            if (id) {
                await prisma.whatsAppServer.update({
                    where: { id: parseInt(id) },
                    data: {
                        status: 'CONNECTED',
                        lastCheck: new Date(),
                        lastError: null,
                    },
                });
            }

            res.json({
                success: true,
                state: 'open',
                message: 'Servidor respondendo',
            });
        }
    } catch (error: any) {
        console.error('Erro ao testar servidor:', error.message);

        // Atualizar status de erro
        const { id } = req.params;
        if (id) {
            await prisma.whatsAppServer.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'ERROR',
                    lastCheck: new Date(),
                    lastError: error.message,
                },
            }).catch(() => { });
        }

        let message = 'Erro ao conectar';
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') message = 'Conexão recusada. Verifique a URL.';
            else if (error.response?.status === 401) message = 'API Key inválida';
            else if (error.response?.status === 404) message = 'Instância não encontrada';
            else if (error.code === 'ETIMEDOUT') message = 'Timeout na conexão';
        }

        res.status(400).json({ success: false, message });
    }
}

/**
 * POST /api/whatsapp-servers/:id/activate
 * Ativa ou desativa servidor
 */
export async function toggleServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const server = await prisma.whatsAppServer.findUnique({
            where: { id: parseInt(id) },
        });

        if (!server) {
            res.status(404).json({ error: 'Servidor não encontrado' });
            return;
        }

        // Verificar posse
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';
        if (!isMaster && server.userId !== userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        // Não permitir ativar servidor sem teste bem-sucedido
        if (isActive && server.status !== 'CONNECTED') {
            res.status(400).json({ error: 'Teste a conexão antes de ativar o servidor' });
            return;
        }

        // Configurar webhook automaticamente quando ativar
        let webhookConfigured = false;
        if (isActive && server.type === 'EVOLUTION') {
            try {
                // Buscar configuração do webhook global
                const webhookConfig = await prisma.webhookConfig.findUnique({ where: { id: 1 } });
                const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
                const webhookUrl = `${baseUrl}/api/webhooks/evolution`;

                // Importar e criar provider
                const { EvolutionProvider } = await import('../services/providers/evolution.provider');
                const provider = new EvolutionProvider({
                    id: server.id,
                    name: server.name,
                    type: 'EVOLUTION',
                    url: server.url,
                    apiKey: server.apiKey,
                    instanceName: server.instanceName,
                    isActive: true,
                    priority: server.priority,
                });

                const result = await provider.configureWebhook(
                    webhookUrl,
                    webhookConfig?.secretToken || '',
                    ['GROUP_PARTICIPANTS_UPDATE', 'GROUPS_UPDATE', 'MESSAGES_UPSERT']
                );

                webhookConfigured = result.success;
                console.log(`[WhatsApp] Webhook configurado para ${server.name}: ${result.success}`);
            } catch (error: any) {
                console.error('[WhatsApp] Erro ao configurar webhook:', error.message);
            }
        }

        const updated = await prisma.whatsAppServer.update({
            where: { id: parseInt(id) },
            data: { isActive },
        });

        res.json({
            message: isActive ? 'Servidor ativado' : 'Servidor desativado',
            webhookConfigured,
            server: { ...updated, apiKey: maskApiKey(updated.apiKey) },
        });
    } catch (error) {
        console.error('Erro ao alternar servidor:', error);
        res.status(500).json({ error: 'Erro ao alternar servidor' });
    }
}

/**
 * PUT /api/whatsapp-servers/reorder
 * Reordena prioridades dos servidores
 */
export async function reorderServers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { order } = req.body; // Array de IDs na ordem desejada

        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Envie um array de IDs' });
            return;
        }

        // Atualizar prioridades
        for (let i = 0; i < order.length; i++) {
            await prisma.whatsAppServer.update({
                where: { id: order[i] },
                data: { priority: i },
            });
        }

        res.json({ message: 'Ordem atualizada' });
    } catch (error) {
        console.error('Erro ao reordenar:', error);
        res.status(500).json({ error: 'Erro ao reordenar servidores' });
    }
}

/**
 * GET /api/whatsapp-servers/:id/qr
 * Retorna o QRCode em Base64 para pareamento
 */
export async function getQrCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const userId = (req.user as any).id;
        const isMaster = (req.user as any).role === 'MASTER';

        const server = await prisma.whatsAppServer.findUnique({
            where: { id: parseInt(id) }
        });

        if (!server) {
            res.status(404).json({ error: 'Servidor não encontrado' });
            return;
        }

        // Verificar posse
        if (!isMaster && server.userId !== userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        const provider = await whatsappProvider.getProviderById(parseInt(id));

        if (provider.connectionStatus === 'open') {
            res.json({ success: true, connected: true, message: 'Conta já conectada!' });
            return;
        }

        // Se for Evolution, buscar o QR atualizado da API
        if (server.type === 'EVOLUTION') {
            try {
                console.log(`[WhatsApp] Buscando QR para instância: ${server.instanceName}`);
                // Tentamos primeiro o endpoint sugerido pelo usuário (/qr)
                let response = await (provider as any).client.get(`/instance/connect/${server.instanceName}`);
                
                // Se não vier no connect, tentamos no /qr
                if (!response.data?.base64 && !response.data?.code) {
                   response = await (provider as any).client.get(`/instance/qr/${server.instanceName}`);
                }

                console.log(`[WhatsApp] Resposta Evolution QR/Connect:`, JSON.stringify(response.data).substring(0, 100) + '...');
                
                const qrCode = response.data?.base64 || response.data?.code || response.data?.qrcode?.base64;
                if (qrCode) {
                    provider.qrCodeBase64 = qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`;
                }
            } catch (err: any) {
                console.error('[WhatsApp] Erro ao buscar QR da Evolution:', err.response?.data || err.message);
            }
        }

        res.json({ 
            success: true, 
            connected: false,
            qrCodeBase64: provider.qrCodeBase64,
            message: provider.qrCodeBase64 ? 'QRCode Disponível' : 'Gerando QRCode... Tente novamente em alguns segundos.'
        });
    } catch (error: any) {
        console.error('Erro ao puxar QR Code:', error.message);
        res.status(500).json({ error: 'Erro interno ao consultar provedor' });
    }
}
