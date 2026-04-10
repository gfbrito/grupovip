import cron from 'node-cron';
import { prisma } from '../config/database';
import { AICreditsService } from './ai-credits.service';

/**
 * Inicia o job de renovação de créditos de IA.
 * Roda todos os dias às 03:00 da manhã.
 */
export const initCreditsScheduler = () => {
    cron.schedule('0 3 * * *', async () => {
        console.log('[AICredits Scheduler] Iniciando verificação de renovação de créditos...');
        
        try {
            // Conta 30 dias atrás
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Busca os records de UserAICredits cujo lastResetAt foi há mais de 30 dias
            const expiredCredits = await prisma.userAICredits.findMany({
                where: {
                    lastResetAt: {
                        lte: thirtyDaysAgo
                    }
                }
            });

            if (expiredCredits.length === 0) {
                console.log('[AICredits Scheduler] Nenhuma renovação pendente hoje.');
                return;
            }

            console.log(`[AICredits Scheduler] Encontrados ${expiredCredits.length} usuários para renovação de créditos.`);

            for (const record of expiredCredits) {
                try {
                    await AICreditsService.resetMonthlyCredits(record.userId);
                    console.log(`[AICredits Scheduler] Créditos mensais renovados para o usuário ${record.userId}.`);
                } catch (err: any) {
                    console.error(`[AICredits Scheduler] Erro ao renovar créditos para usuário ${record.userId}:`, err.message);
                }
            }
            
            console.log('[AICredits Scheduler] Verificação concluída.');

        } catch (error: any) {
            console.error('[AICredits Scheduler] Falha na execução global do cron:', error.message);
        }
    });
    
    console.log('[AICredits Scheduler] Job agendado para rodar diariamente às 03:00 da manhã.');
};
