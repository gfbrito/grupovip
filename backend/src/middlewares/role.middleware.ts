import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

type Role = 'USER' | 'ADMIN' | 'MASTER';

/**
 * Middleware para verificar se o usuário tem a role necessária
 * Hierarquia: MASTER > ADMIN > USER
 */
export function requireRole(...allowedRoles: Role[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const userRole = (req.user as any).role || 'USER';

        // MASTER tem acesso a tudo
        if (userRole === 'MASTER') {
            next();
            return;
        }

        // Verificar se a role do usuário está nas permitidas
        if (allowedRoles.includes(userRole as Role)) {
            next();
            return;
        }

        // ADMIN tem acesso a rotas de ADMIN e USER
        if (userRole === 'ADMIN' && allowedRoles.includes('USER')) {
            next();
            return;
        }

        res.status(403).json({
            error: 'Acesso negado. Você não tem permissão para acessar este recurso.',
            requiredRoles: allowedRoles,
            yourRole: userRole
        });
    };
}

/**
 * Middleware para permitir apenas MASTER admin
 */
export function requireMaster() {
    return requireRole('MASTER');
}

/**
 * Middleware para permitir ADMIN ou superior
 */
export function requireAdmin() {
    return requireRole('ADMIN', 'MASTER');
}
