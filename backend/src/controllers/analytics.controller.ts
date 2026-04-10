import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/database';

export const getDashboardAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // 1. Visão Global (Soma de todos os lançamentos)
        const launches = await prisma.launch.findMany({
            where: { userId },
            select: { id: true, name: true, createdAt: true }
        });

        const launchIds = launches.map(l => l.id);

        if (launchIds.length === 0) {
            return res.json({
                totalLaunches: 0,
                totalGroups: 0,
                totalClicks: 0,
                totalLeads: 0,
                activeLeads: 0,
                retentionRate: '0.0',
                conversionRate: '0.0',
                chartData: []
            });
        }

        const [
            totalGroups,
            totalClicks,
            totalLeads,
            activeLeads
        ] = await Promise.all([
            prisma.launchGroup.count({ where: { launchId: { in: launchIds } } }),
            prisma.launchClick.count({ where: { launchId: { in: launchIds } } }),
            prisma.launchLeadGroup.count({
                where: { group: { launchId: { in: launchIds } } }
            }), // Historicamente quantos entraram
            prisma.launchLeadGroup.count({
                where: { 
                    group: { launchId: { in: launchIds } },
                    isActive: true
                }
            }) // Quantos ainda estão nos grupos
        ]);

        // Retenção: Dos que entraram, quantos ficaram?
        const retentionRate = totalLeads > 0 ? ((activeLeads / totalLeads) * 100).toFixed(1) : '0.0';
        
        // Conversão Absoluta: Dos cliques, quantos estão ativos hoje?
        const conversionRate = totalClicks > 0 ? ((activeLeads / totalClicks) * 100).toFixed(1) : '0.0';

        // 2. Gráfico de Crescimento de Leads vs Evasões ao longo dos últimos 14 dias
        const days = 14;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const recentEntries = await prisma.launchLeadGroup.findMany({
            where: {
                group: { launchId: { in: launchIds } },
                joinedAt: { gte: startDate }
            },
            select: { joinedAt: true }
        });

        const recentExits = await prisma.launchLeadGroup.findMany({
            where: {
                group: { launchId: { in: launchIds } },
                leftAt: { gte: startDate }
            },
            select: { leftAt: true }
        });

        const entriesByDay: Record<string, number> = {};
        const exitsByDay: Record<string, number> = {};

        recentEntries.forEach(e => {
            const day = e.joinedAt.toISOString().split('T')[0];
            entriesByDay[day] = (entriesByDay[day] || 0) + 1;
        });

        recentExits.forEach(e => {
            if (e.leftAt) {
                const day = e.leftAt.toISOString().split('T')[0];
                exitsByDay[day] = (exitsByDay[day] || 0) + 1;
            }
        });

        const chartData = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const day = date.toISOString().split('T')[0];
            
            // Format to DD/MM
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            chartData.push({
                date: formattedDate,
                rawDate: day,
                entradas: entriesByDay[day] || 0,
                saidas: exitsByDay[day] || 0,
            });
        }

        res.json({
            totalLaunches: launches.length,
            totalGroups,
            totalClicks,
            totalLeads,
            activeLeads,
            retentionRate,
            conversionRate,
            chartData
        });

    } catch (error) {
        console.error('[Analytics] Erro ao carregar dashboard', error);
        res.status(500).json({ error: 'Erro ao carregar métricas' });
    }
};
