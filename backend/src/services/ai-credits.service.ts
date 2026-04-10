import { prisma } from '../config/database';

export class AICreditsService {
    /**
     * Retorna o saldo do usuário. Se não existir o registro, cria um baseado no plano atual.
     */
    static async getOrCreateCredits(userId: number) {
        let credits = await prisma.userAICredits.findUnique({
            where: { userId },
            include: { user: { include: { plan: true } } },
        });

        if (!credits) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { plan: true },
            });

            if (!user) throw new Error('Usuário não encontrado');

            credits = await prisma.userAICredits.create({
                data: {
                    userId,
                    monthlyQuota: user.plan.aiTokensPerMonth,
                    monthlyUsed: 0,
                    extraCredits: 0,
                },
                include: { user: { include: { plan: true } } },
            });
        }

        return credits;
    }

    /**
     * Retorna o resumo formatado do saldo
     */
    static async getBalance(userId: number) {
        const credits = await this.getOrCreateCredits(userId);
        
        const availableMonthly = Math.max(0, credits.monthlyQuota - credits.monthlyUsed);
        const totalAvailable = availableMonthly + credits.extraCredits;
        
        return {
            monthlyQuota: credits.monthlyQuota,
            monthlyUsed: credits.monthlyUsed,
            extraCredits: credits.extraCredits,
            availableMonthly,
            totalAvailable,
            lastResetAt: credits.lastResetAt,
            isUnlimited: credits.monthlyQuota >= 99000000 // Convenção para ilimitado
        };
    }

    /**
     * Valida se usuário tem saldo suficiente (lança erro se não tiver)
     */
    static async checkCredits(userId: number, requiredCredits: number = 1): Promise<boolean> {
        const balance = await this.getBalance(userId);
        
        if (balance.isUnlimited) return true;
        
        if (balance.totalAvailable < requiredCredits) {
            throw new Error('INSUFFICIENT_AI_CREDITS');
        }
        
        return true;
    }

    /**
     * Consome créditos, debitando primeiro da cota mensal, e depois dos extras
     */
    static async consumeCredits(
        userId: number,
        operation: string,
        creditsToConsume: number,
        modelName: string,
        refId?: number,
        refType?: string
    ) {
        const credits = await this.getOrCreateCredits(userId);
        
        if (credits.monthlyQuota >= 99000000) {
            // Ilimitado, apenas registra a transação com cost 0
            await prisma.aITransaction.create({
                data: {
                    userId,
                    operation,
                    creditsUsed: creditsToConsume,
                    model: modelName,
                    source: 'UNLIMITED',
                    refId,
                    refType
                }
            });
            return;
        }

        const availableMonthly = Math.max(0, credits.monthlyQuota - credits.monthlyUsed);

        let monthlyConsumed = 0;
        let extraConsumed = 0;

        if (availableMonthly >= creditsToConsume) {
            monthlyConsumed = creditsToConsume;
        } else {
            monthlyConsumed = availableMonthly;
            extraConsumed = creditsToConsume - availableMonthly;
            
            if (credits.extraCredits < extraConsumed) {
                throw new Error('INSUFFICIENT_AI_CREDITS');
            }
        }

        await prisma.$transaction(async (tx) => {
            // Atualiza saldos
            await tx.userAICredits.update({
                where: { userId },
                data: {
                    monthlyUsed: { increment: monthlyConsumed },
                    extraCredits: { decrement: extraConsumed }
                }
            });

            // Registra transações separadas se usou de fontes diferentes
            if (monthlyConsumed > 0) {
                await tx.aITransaction.create({
                    data: {
                        userId,
                        operation,
                        creditsUsed: monthlyConsumed,
                        model: modelName,
                        source: 'MONTHLY',
                        refId,
                        refType
                    }
                });
            }

            if (extraConsumed > 0) {
                await tx.aITransaction.create({
                    data: {
                        userId,
                        operation,
                        creditsUsed: extraConsumed,
                        model: modelName,
                        source: 'EXTRA',
                        refId,
                        refType
                    }
                });
            }
        });
    }

    /**
     * Renova a cota mensal (chamado via webhook ou cron job)
     */
    static async resetMonthlyCredits(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { plan: true },
        });

        if (!user) return;

        await prisma.userAICredits.upsert({
            where: { userId },
            update: {
                monthlyQuota: user.plan.aiTokensPerMonth,
                monthlyUsed: 0,
                lastResetAt: new Date()
            },
            create: {
                userId,
                monthlyQuota: user.plan.aiTokensPerMonth,
                monthlyUsed: 0,
                extraCredits: 0,
                lastResetAt: new Date()
            }
        });
    }

    /**
     * Adiciona pacotes de créditos extras
     */
    static async addExtraCredits(userId: number, tokenAmount: number, purchaseId?: number) {
        await prisma.userAICredits.update({
            where: { userId },
            data: {
                extraCredits: { increment: tokenAmount }
            }
        });
    }
}
