import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Mascara a API key mantendo apenas os últimos 4 caracteres
 */
function maskApiKey(key: string | null): string | null {
    if (!key || key.length < 8) return key ? '****' : null;
    return `****${key.slice(-4)}`;
}

/**
 * GET /api/settings
 * Retorna configuração atual (sem expor a key completa)
 */
export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        let config = await prisma.appConfig.findUnique({ where: { id: 1 } });

        // Se não existir, cria o singleton
        if (!config) {
            config = await prisma.appConfig.create({
                data: { id: 1, isConfigured: false },
            });
        }

        res.json({
            evolutionUrl: config.evolutionUrl,
            instanceName: config.instanceName,
            isConfigured: config.isConfigured,
            maskedKey: maskApiKey(config.evolutionKey),
            updatedAt: config.updatedAt,
        });
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
}

/**
 * PUT /api/settings
 * Atualiza configuração da Evolution API
 */
export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { evolutionUrl, evolutionKey, instanceName } = req.body;

        // Validações
        if (!evolutionUrl || !evolutionKey || !instanceName) {
            res.status(400).json({ error: 'Todos os campos são obrigatórios' });
            return;
        }

        // Validar formato da URL
        try {
            new URL(evolutionUrl);
        } catch {
            res.status(400).json({ error: 'URL inválida. Use o formato http:// ou https://' });
            return;
        }

        // Remover barra final da URL se existir
        const cleanUrl = evolutionUrl.replace(/\/+$/, '');

        const config = await prisma.appConfig.upsert({
            where: { id: 1 },
            update: {
                evolutionUrl: cleanUrl,
                evolutionKey,
                instanceName,
                isConfigured: true,
            },
            create: {
                id: 1,
                evolutionUrl: cleanUrl,
                evolutionKey,
                instanceName,
                isConfigured: true,
            },
        });

        res.json({
            message: 'Configurações salvas com sucesso',
            evolutionUrl: config.evolutionUrl,
            instanceName: config.instanceName,
            isConfigured: config.isConfigured,
            maskedKey: maskApiKey(config.evolutionKey),
        });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
}

/**
 * POST /api/settings/test
 * Testa conexão com a Evolution API usando as credenciais enviadas no body
 */
export async function testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        let { evolutionUrl, evolutionKey, instanceName } = req.body;

        if (!evolutionUrl || !instanceName) {
            res.status(400).json({
                success: false,
                message: 'URL e Instância são obrigatórios para o teste',
            });
            return;
        }

        // Se a key vier mascarada, busca a real no banco
        if (evolutionKey === '********' || !evolutionKey) {
            const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
            if (config?.evolutionKey) {
                evolutionKey = config.evolutionKey;
            } else if (!evolutionKey) {
                res.status(400).json({
                    success: false,
                    message: 'API Key não informada e não encontrada no sistema',
                });
                return;
            }
        }

        // Remover barra final
        const cleanUrl = evolutionUrl.replace(/\/+$/, '');

        // Testar conexão: busca estado da instância
        const response = await axios.get(
            `${cleanUrl}/instance/connectionState/${instanceName}`,
            {
                headers: {
                    apikey: evolutionKey,
                },
                timeout: 10000,
            }
        );

        const state = response.data?.instance?.state || response.data?.state;

        if (state === 'open') {
            res.json({
                success: true,
                message: 'Conexão estabelecida com sucesso!',
                state: 'open',
            });
        } else if (state === 'close' || state === 'closed') {
            res.json({
                success: true,
                message: 'API conectada, mas instância desconectada. Escaneie o QR Code.',
                state: 'close',
            });
        } else {
            res.json({
                success: true,
                message: `Conexão OK. Estado: ${state || 'desconhecido'}`,
                state: state || 'unknown',
            });
        }
    } catch (error) {
        console.error('Erro ao testar conexão:', error);

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                res.status(400).json({
                    success: false,
                    message: 'Não foi possível conectar. Verifique se a URL está correta.',
                });
                return;
            }
            if (error.response?.status === 401) {
                res.status(400).json({
                    success: false,
                    message: 'API Key inválida. Verifique suas credenciais.',
                });
                return;
            }
            if (error.response?.status === 404) {
                res.status(400).json({
                    success: false,
                    message: 'Instância não encontrada. Verifique o nome da instância.',
                });
                return;
            }
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                res.status(400).json({
                    success: false,
                    message: 'Tempo limite excedido. O servidor não respondeu.',
                });
                return;
            }
        }

        res.status(400).json({
            success: false,
            message: 'Erro ao testar conexão. Verifique as configurações.',
        });
    }
}
