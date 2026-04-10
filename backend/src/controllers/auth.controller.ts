import { Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { AuthenticatedRequest, generateToken, AuthUser } from '../middlewares/auth.middleware';

const SALT_ROUNDS = 10;
const MASTER_EMAIL = 'gfbrito@gmail.com';

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { email, password, name } = req.body;

        // Validação básica
        if (!email || !password || !name) {
            res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
            return;
        }

        // Verificar se email já existe
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: 'Este email já está em uso' });
            return;
        }

        // Determinar role - gfbrito@gmail.com é MASTER
        const role = email.toLowerCase() === MASTER_EMAIL.toLowerCase() ? 'MASTER' : 'USER';

        // Se for MASTER, usa plano ENTERPRISE (id=4), senão FREE (id=1)
        const planId = role === 'MASTER' ? 4 : 1;

        // Criar usuário
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                planId,
            },
            include: {
                plan: true,
            },
        });

        // Gerar token e setar cookie
        const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
        const token = generateToken(authUser);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        });

        const config = await prisma.appConfig.findUnique({
            where: { id: 1 },
            select: { enableAI: true }
        });

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan,
                enableAI: config?.enableAI ?? true,
            },
        });
    } catch (error) {
        console.error('❌ Erro detalhado ao registrar usuário:', error);
        res.status(500).json({ 
            error: 'Erro interno ao criar usuário',
            details: process.env.NODE_ENV === 'development' ? error : undefined 
        });
    }
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email e senha são obrigatórios' });
            return;
        }

        // Buscar usuário com plano
        const user = await prisma.user.findUnique({
            where: { email },
            include: { plan: true },
        });
        if (!user) {
            res.status(401).json({ error: 'Email ou senha incorretos' });
            return;
        }

        // Verificar senha
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ error: 'Email ou senha incorretos' });
            return;
        }

        // Gerar token e setar cookie
        const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
        const token = generateToken(authUser);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const config = await prisma.appConfig.findUnique({
            where: { id: 1 },
            select: { enableAI: true }
        });

        res.json({
            message: 'Login realizado com sucesso',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan,
                enableAI: config?.enableAI ?? true,
            },
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro interno ao fazer login' });
    }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ message: 'Logout realizado com sucesso' });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Não autorizado' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { plan: true },
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        const config = await prisma.appConfig.findUnique({
            where: { id: 1 },
            select: { enableAI: true }
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt,
                plan: user.plan,
                enableAI: config?.enableAI ?? true,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
}

