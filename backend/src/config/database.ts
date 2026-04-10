import { PrismaClient } from '@prisma/client';

// Singleton do Prisma Client para evitar múltiplas conexões
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Garante que o AppConfig singleton exista
export async function ensureAppConfig(): Promise<void> {
    const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
    if (!config) {
        await prisma.appConfig.create({
            data: { id: 1, isConfigured: false },
        });
    }
}
