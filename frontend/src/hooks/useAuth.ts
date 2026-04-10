'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Plan {
    id: number;
    name: string;
    displayName: string;
    maxLaunches: number;
    maxGroupsPerLaunch: number;
    maxLeads: number;
    maxWhatsAppServers: number;
    aiEnabled: boolean;
    privateMessagesEnabled: boolean;
    webhooksEnabled: boolean;
}

interface User {
    id: number;
    email: string;
    name: string;
    role: string;
    plan?: Plan;
    enableAI?: boolean;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = useCallback(async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data.user);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { token, user } = response.data;
        if (token) {
            localStorage.setItem('token', token);
        }
        setUser(user);
        return response.data;
    };
 
    const register = async (email: string, password: string, name: string) => {
        const response = await api.post('/auth/register', { email, password, name });
        const { token, user } = response.data;
        if (token) {
            localStorage.setItem('token', token);
        }
        setUser(user);
        return response.data;
    };
 
    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignora erro no logout
        } finally {
            localStorage.removeItem('token');
            setUser(null);
            router.push('/login');
        }
    };

    return {
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
    };
}
