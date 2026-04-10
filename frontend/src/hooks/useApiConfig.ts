'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface ApiConfig {
    evolutionUrl: string | null;
    instanceName: string | null;
    isConfigured: boolean;
    maskedKey: string | null;
}

export function useApiConfig() {
    const [config, setConfig] = useState<ApiConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchConfig = useCallback(async () => {
        try {
            const response = await api.get('/settings');
            setConfig(response.data);
        } catch (err: any) {
            // Se for 401, o useAuth já deve tratar, mas evitamos travar o config
            console.error('Erro ao buscar configuração da API:', err);
            setConfig(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const refresh = () => {
        setLoading(true);
        fetchConfig();
    };

    return {
        config,
        loading,
        isConfigured: config?.isConfigured ?? false,
        refresh,
    };
}
