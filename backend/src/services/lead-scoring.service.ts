import { prisma } from '../config/database';

export type RequestEventType =
    | 'GROUP_JOIN'
    | 'GROUP_LEAVE'
    | 'MESSAGE_SENT'
    | 'MESSAGE_QUESTION'
    | 'MESSAGE_READ'
    | 'REACTION'
    | 'PRESENCE_ACTIVE'
    | 'CALL'
    | 'CONTACT_SAVED'
    | 'LINK_CLICK'
    | 'REPLY';

const SCORE_RULES: Record<RequestEventType, number> = {
    'GROUP_JOIN': 10,
    'GROUP_LEAVE': -5,
    'MESSAGE_SENT': 3,
    'MESSAGE_QUESTION': 5,
    'MESSAGE_READ': 2,
    'REACTION': 5,
    'PRESENCE_ACTIVE': 1,
    'CALL': 15,
    'CONTACT_SAVED': 8,
    'LINK_CLICK': 5,
    'REPLY': 8
};

export class LeadScoringService {

    /**
     * Registra um evento de score para um lead
     */
    async trackEvent(
        launchId: number,
        leadId: number,
        eventType: RequestEventType,
        reason?: string,
        metadata?: any
    ) {
        try {
            const points = SCORE_RULES[eventType] || 0;
            if (points === 0) return;

            // Registrar evento
            await prisma.leadScoreEvent.create({
                data: {
                    launchId,
                    leadId,
                    event: eventType,
                    points,
                    reason,
                    metadata: metadata ? JSON.stringify(metadata) : null
                }
            });

            // Atualizar score total do lead
            await this.updateLeadScore(leadId);

            console.log(`[LeadScoring] (${eventType}) Lead #${leadId} ganhou ${points} pontos`);
        } catch (error) {
            console.error('[LeadScoring] Erro ao registrar evento:', error);
        }
    }

    /**
     * Recalcula e atualiza o score total de um lead
     */
    private async updateLeadScore(leadId: number) {
        const result = await prisma.leadScoreEvent.aggregate({
            where: { leadId },
            _sum: { points: true }
        });

        const totalScore = result._sum.points || 0;

        await prisma.launchLead.update({
            where: { id: leadId },
            data: {
                score: totalScore,
                scoreUpdatedAt: new Date()
            }
        });
    }

    /**
     * Retorna a classificação do lead baseada no score
     */
    getClassification(score: number): 'HOT' | 'WARM' | 'COOL' | 'COLD' {
        if (score >= 50) return 'HOT';
        if (score >= 20) return 'WARM';
        if (score >= 5) return 'COOL';
        return 'COLD';
    }
}

export const leadScoringService = new LeadScoringService();
