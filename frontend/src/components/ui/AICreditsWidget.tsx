'use client';

import { useEffect } from 'react';
import { useAICredits } from '../../hooks/useAICredits';
import { Zap, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../lib/utils';

export function AICreditsWidget() {
    const { balance, fetchBalance } = useAICredits();

    useEffect(() => {
        fetchBalance();
        // Recarregar a cada 5 minutos
        const interval = setInterval(fetchBalance, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    if (!balance) return null;

    if (balance.isUnlimited) {
        return (
            <Link href="/ai-credits" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors text-sm font-medium border border-indigo-500/20">
                <Zap className="w-4 h-4" />
                <span>IA Ilimitada</span>
            </Link>
        );
    }

    const availableMonthly = balance.availableMonthly;
    const totalExtra = balance.extraCredits;
    const totalAvailable = availableMonthly + totalExtra;
    const percentageUsed = balance.monthlyQuota > 0 ? (balance.monthlyUsed / balance.monthlyQuota) * 100 : 0;
    
    // Alerta se tiver menos de 20% da cota mensal E não tiver extra
    const isLow = percentageUsed > 80 && totalExtra === 0;
    const isZero = totalAvailable === 0;

    return (
        <Link 
            href="/ai-credits" 
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors text-sm font-medium border",
                isZero 
                    ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20" 
                    : isLow 
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
            )}
        >
            {isZero || isLow ? <AlertCircle className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
            <span>{totalAvailable.toLocaleString('pt-BR')} créditos</span>
        </Link>
    );
}
