import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-sender-secret-key-change-in-production';

export interface AuthUser {
    id: number;
    email: string;
    name: string;
    role: string;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
        return;
    }
}

export function generateToken(user: AuthUser): string {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export { JWT_SECRET };

