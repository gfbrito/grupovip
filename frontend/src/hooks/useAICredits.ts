import { useState, useCallback } from 'react';
import api from '../lib/api';

export interface AICreditsBalance {
    monthlyQuota: number;
    monthlyUsed: number;
    extraCredits: number;
    availableMonthly: number;
    totalAvailable: number;
    lastResetAt: string;
    isUnlimited: boolean;
}

export interface AITransaction {
    id: number;
    operation: string;
    creditsUsed: number;
    model: string;
    source: string;
    createdAt: string;
}

export interface AICreditPackage {
    id: string;
    name: string;
    tokens: number;
    priceBRL: number;
}

export function useAICredits() {
    const [balance, setBalance] = useState<AICreditsBalance | null>(null);
    const [transactions, setTransactions] = useState<AITransaction[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [packages, setPackages] = useState<AICreditPackage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/ai-credits/balance');
            setBalance(data.balance);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao carregar saldo de IA');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async (limit = 20, offset = 0) => {
        try {
            setLoading(true);
            const { data } = await api.get(`/ai-credits/history?limit=${limit}&offset=${offset}`);
            setTransactions(data.transactions);
            setTotalTransactions(data.total);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao carregar histórico de IA');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPackages = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/ai-credits/packages');
            setPackages(data.packages);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao carregar pacotes de IA');
        } finally {
            setLoading(false);
        }
    }, []);

    const purchasePackage = async (packageId: string) => {
        try {
            setLoading(true);
            const { data } = await api.post('/ai-credits/purchase', { packageId });
            return data;
        } catch (err: any) {
            throw new Error(err.response?.data?.error || 'Erro ao iniciar compra');
        } finally {
            setLoading(false);
        }
    };

    return {
        balance,
        transactions,
        totalTransactions,
        packages,
        loading,
        error,
        fetchBalance,
        fetchHistory,
        fetchPackages,
        purchasePackage
    };
}
