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
        let config = await prisma.appConfig.findUnique({ where: { id: 1 } });
        if (!config) {
            config = await prisma.appConfig.findFirst();
        }

        // Critério resiliente: se tem URL e Key, permitimos o uso
        const isConfigured = !!config?.evolutionUrl && !!config?.evolutionKey;

        if (!isConfigured) {
            res.status(503).json({
                error: 'API não configurada',
                message: 'Aguarde a configuração do sistema pelo administrador.',
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
