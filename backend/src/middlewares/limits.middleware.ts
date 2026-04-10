import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { prisma } from '../config/database';

type LimitType = 'launches' | 'groups' | 'leads' | 'whatsapp_servers';

/**
 * Middleware para verificar limites do plano do usuário
 */
export function checkLimit(limitType: LimitType, launchId?: number) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        try {
            // Buscar usuário com plano
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { plan: true },
            });

            if (!user || !user.plan) {
                res.status(500).json({ error: 'Erro ao verificar plano do usuário' });
                return;
            }

            const plan = user.plan;
            let currentCount = 0;
            let limit = 0;
            let resourceName = '';

            switch (limitType) {
                case 'launches':
                    currentCount = await prisma.launch.count({
                        where: { userId: user.id },
                    });
                    limit = plan.maxLaunches;
                    resourceName = 'lançamentos';
                    break;

                case 'groups':
                    // Precisa do launchId para contar grupos do lançamento
                    const launchIdToUse = launchId || req.params.launchId || req.body.launchId;
                    if (launchIdToUse) {
                        currentCount = await prisma.launchGroup.count({
                            where: { launchId: parseInt(launchIdToUse) },
                        });
                    }
                    limit = plan.maxGroupsPerLaunch;
                    resourceName = 'grupos por lançamento';
                    break;

                case 'leads':
                    currentCount = await prisma.launchLead.count({
                        where: {
                            launch: { userId: user.id },
                        },
                    });
                    limit = plan.maxLeads;
                    resourceName = 'leads';
                    break;

                case 'whatsapp_servers':
                    currentCount = await prisma.whatsAppServer.count();
                    limit = plan.maxWhatsAppServers;
                    resourceName = 'conexões WhatsApp';
                    break;
            }

            // Verificar se atingiu o limite
            if (currentCount >= limit) {
                res.status(403).json({
                    error: `Limite atingido`,
                    message: `Você atingiu o limite de ${limit} ${resourceName} do seu plano ${plan.displayName}.`,
                    limit,
                    current: currentCount,
                    plan: plan.name,
                    upgradeRequired: true,
                });
                return;
            }

            // Adicionar info do plano ao request para uso posterior
            (req as any).userPlan = plan;
            (req as any).limitInfo = { type: limitType, current: currentCount, limit };

            next();
        } catch (error) {
            console.error('Erro ao verificar limite:', error);
            res.status(500).json({ error: 'Erro ao verificar limites do plano' });
        }
    };
}

/**
 * Middleware para verificar se uma feature está habilitada no plano
 */
export function checkFeature(feature: 'ai' | 'privateMessages' | 'webhooks') {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { plan: true },
            });

            if (!user || !user.plan) {
                res.status(500).json({ error: 'Erro ao verificar plano do usuário' });
                return;
            }

            const plan = user.plan;
            let featureEnabled = false;
            let featureName = '';

            switch (feature) {
                case 'ai':
                    featureEnabled = plan.aiEnabled;
                    featureName = 'IA de Respostas';
                    break;
                case 'privateMessages':
                    featureEnabled = plan.privateMessagesEnabled;
                    featureName = 'Mensagens Privadas';
                    break;
                case 'webhooks':
                    featureEnabled = plan.webhooksEnabled;
                    featureName = 'Webhooks';
                    break;
            }

            if (!featureEnabled) {
                res.status(403).json({
                    error: `Feature não disponível`,
                    message: `A feature "${featureName}" não está disponível no seu plano ${plan.displayName}.`,
                    feature,
                    plan: plan.name,
                    upgradeRequired: true,
                });
                return;
            }

            next();
        } catch (error) {
            console.error('Erro ao verificar feature:', error);
            res.status(500).json({ error: 'Erro ao verificar features do plano' });
        }
    };
}

/**
 * Helper para obter uso atual do usuário
 */
export async function getUserUsage(userId: number) {
    const [launches, leads, whatsappServers] = await Promise.all([
        prisma.launch.count({ where: { userId } }),
        prisma.launchLead.count({ where: { launch: { userId } } }),
        prisma.whatsAppServer.count(),
    ]);

    return { launches, leads, whatsappServers };
}
