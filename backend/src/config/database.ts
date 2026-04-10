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

// Garante que os planos padrão existam (Equivale ao seed)
export async function ensurePlans(): Promise<void> {
    const plans = [
        { name: 'FREE', displayName: 'Gratuito', maxLaunches: 1, maxGroupsPerLaunch: 3, maxLeads: 500, maxWhatsAppServers: 1, aiEnabled: false, privateMessagesEnabled: false, webhooksEnabled: false, price: 0, billingPeriod: 'MONTHLY' },
        { name: 'STARTER', displayName: 'Iniciante', maxLaunches: 3, maxGroupsPerLaunch: 10, maxLeads: 2000, maxWhatsAppServers: 1, aiEnabled: false, privateMessagesEnabled: true, webhooksEnabled: true, price: 97, billingPeriod: 'MONTHLY' },
        { name: 'PRO', displayName: 'Profissional', maxLaunches: 10, maxGroupsPerLaunch: 30, maxLeads: 10000, maxWhatsAppServers: 3, aiEnabled: true, privateMessagesEnabled: true, webhooksEnabled: true, price: 197, billingPeriod: 'MONTHLY' },
        { name: 'ENTERPRISE', displayName: 'Enterprise', maxLaunches: 999999, maxGroupsPerLaunch: 999999, maxLeads: 999999, maxWhatsAppServers: 10, aiEnabled: true, privateMessagesEnabled: true, webhooksEnabled: true, price: 497, billingPeriod: 'MONTHLY' },
    ];

    for (const plan of plans) {
        await prisma.plan.upsert({
            where: { name: plan.name },
            update: plan,
            create: plan,
        });
    }
}
