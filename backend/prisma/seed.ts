import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed...');

    // ==================== CRIAR PLANOS ====================
    const plans = [
        {
            name: 'FREE',
            displayName: 'Gratuito',
            maxLaunches: 1,
            maxGroupsPerLaunch: 3,
            maxLeads: 500,
            maxWhatsAppServers: 1,
            aiEnabled: false,
            privateMessagesEnabled: false,
            webhooksEnabled: false,
            price: 0,
            billingPeriod: 'MONTHLY',
        },
        {
            name: 'STARTER',
            displayName: 'Iniciante',
            maxLaunches: 3,
            maxGroupsPerLaunch: 10,
            maxLeads: 2000,
            maxWhatsAppServers: 1,
            aiEnabled: false,
            privateMessagesEnabled: true,
            webhooksEnabled: true,
            price: 97,
            billingPeriod: 'MONTHLY',
        },
        {
            name: 'PRO',
            displayName: 'Profissional',
            maxLaunches: 10,
            maxGroupsPerLaunch: 30,
            maxLeads: 10000,
            maxWhatsAppServers: 3,
            aiEnabled: true,
            privateMessagesEnabled: true,
            webhooksEnabled: true,
            price: 197,
            billingPeriod: 'MONTHLY',
        },
        {
            name: 'ENTERPRISE',
            displayName: 'Enterprise',
            maxLaunches: 999999,
            maxGroupsPerLaunch: 999999,
            maxLeads: 999999,
            maxWhatsAppServers: 10,
            aiEnabled: true,
            privateMessagesEnabled: true,
            webhooksEnabled: true,
            price: 497,
            billingPeriod: 'MONTHLY',
        },
    ];

    for (const plan of plans) {
        await prisma.plan.upsert({
            where: { name: plan.name },
            update: plan,
            create: plan,
        });
        console.log(`  ✓ Plano ${plan.name} criado/atualizado`);
    }

    // ==================== CRIAR/ATUALIZAR MASTER ADMIN ====================
    const masterEmail = 'gfbrito@gmail.com';
    const existingMaster = await prisma.user.findUnique({
        where: { email: masterEmail },
    });

    const enterprisePlan = await prisma.plan.findUnique({
        where: { name: 'ENTERPRISE' },
    });

    if (existingMaster) {
        await prisma.user.update({
            where: { email: masterEmail },
            data: {
                role: 'MASTER',
                planId: enterprisePlan!.id,
            },
        });
        console.log(`  ✓ Usuário ${masterEmail} atualizado para MASTER`);
    } else {
        console.log(`  ⚠ Usuário ${masterEmail} não existe ainda. Será promovido a MASTER quando registrar.`);
    }

    console.log('✅ Seed concluído!');
}

main()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
