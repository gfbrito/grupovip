import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

/**
 * Middleware que bloqueia endpoints que dependem da Evolution API
 * se ela ainda não estiver configurada
 */
export async function configGuardMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const config = await prisma.appConfig.findUnique({ where: { id: 1 } });

        if (!config || !config.isConfigured) {
            res.status(503).json({
                error: 'API não configurada',
                message: 'Configure a Evolution API em Configurações antes de usar este recurso.',
                code: 'API_NOT_CONFIGURED',
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Erro ao verificar configuração:', error);
        res.status(500).json({ error: 'Erro interno ao verificar configuração' });
        return;
    }
}
