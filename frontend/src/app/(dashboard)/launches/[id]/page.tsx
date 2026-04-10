'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Users,
    MousePointer,
    UserPlus,
    BarChart3,
    ExternalLink,
    MessageSquare,
    AlertCircle
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';

interface Launch {
    id: number;
    name: string;
    description: string | null;
    slug: string;
    logoUrl: string | null;
    status: string;
}

interface LaunchStats {
    totalLeads: number;
    totalGroups: number;
    totalConversions: number;
    conversionRate: number;
    leadsToday?: number;
    activeGroups?: number;
}

export default function LaunchDashboardPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [stats, setStats] = useState<LaunchStats | null>(null);

    const fetchLaunch = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/launches/${id}`);
            setLaunch(response.data.launch);
            setStats(response.data.stats);
        } catch (error) {
            console.error('Erro ao buscar lançamento:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Não foi possível carregar os dados do lançamento.',
            });
        } finally {
            setLoading(false);
        }
    }, [id, addToast]);

    useEffect(() => {
        if (id) {
            fetchLaunch();
        }
    }, [id, fetchLaunch]);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!launch) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <AlertCircle className="w-10 h-10 mb-4 text-slate-400" />
                <p>Lançamento não encontrado.</p>
            </div>
        );
    }

    // Cards de métricas
    const cards = [
        {
            title: 'Total de Leads',
            value: stats.totalLeads,
            subValue: `${stats.activeLeads} ativos`,
            icon: Users,
            color: 'bg-blue-50 text-blue-600',
        },
        {
            title: 'Grupos',
            value: stats.totalGroups,
            subValue: `${stats.fullGroups} cheios`,
            icon: MessageSquare,
            color: 'bg-green-50 text-green-600',
        },
        {
            title: 'Cliques (Hoje)',
            value: stats.todayClicks,
            subValue: `${stats.totalClicks} total`,
            icon: MousePointer,
            color: 'bg-purple-50 text-purple-600',
        },
        {
            title: 'Taxa de Conversão',
            value: `${stats.conversionRate}%`,
            subValue: `${stats.todayEntries} entradas hoje`,
            icon: BarChart3,
            color: 'bg-orange-50 text-orange-600',
        },
    ];

    return (
        <div className="container mx-auto px-4 py-8">
            <LaunchHeader launch={launch} />
            <LaunchTabs launchId={id} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {cards.map((card, index) => (
                    <Card key={index} className="border-slate-200">
                        <Card.Body className="flex items-start justify-between p-6">
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
                                <p className="text-xs text-slate-500 mt-1">{card.subValue}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${card.color}`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                        </Card.Body>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Informações Gerais */}
                <Card className="lg:col-span-2">
                    <Card.Header>
                        <h3 className="font-semibold text-slate-900">Visão Geral</h3>
                    </Card.Header>
                    <Card.Body>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500 mb-1">Capacidade Total</p>
                                    <p className="text-lg font-semibold text-slate-900">{stats.capacity} leads</p>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                                        <div
                                            className="bg-indigo-600 h-1.5 rounded-full"
                                            style={{ width: `${Math.min((stats.totalMembers / stats.capacity) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {Math.round((stats.totalMembers / stats.capacity) * 100) || 0}% ocupado
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500 mb-1">Fila de Criação</p>
                                    <p className="text-lg font-semibold text-slate-900">
                                        {stats.queuePending > 0 ? `${stats.queuePending} grupos` : 'Vazia'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {stats.queuePending > 0 ? 'Processando novos grupos...' : 'Todos grupos criados'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium text-slate-900 mb-2">Links Importantes</h4>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        <span className="text-sm text-slate-600 truncate">
                                            {typeof window !== 'undefined' ? `${window.location.origin}/l/${launch.slug}` : `/l/${launch.slug}`}
                                        </span>
                                    </div>
                                    <a
                                        href={`/l/${launch.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                        Acessar
                                    </a>
                                </div>
                            </div>
                        </div>
                    </Card.Body>
                </Card>

                {/* Status Recente */}
                <Card>
                    <Card.Header>
                        <h3 className="font-semibold text-slate-900">Atividade Recente</h3>
                    </Card.Header>
                    <Card.Body>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Entradas (7 dias)</span>
                                <span className="text-sm font-medium text-slate-900">{stats.entriesLast7Days}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Cliques (7 dias)</span>
                                <span className="text-sm font-medium text-slate-900">TODO</span>
                            </div>
                            {/* Adicionar mais métricas aqui futuramente */}
                        </div>
                    </Card.Body>
                </Card>
            </div>
        </div>
    );
}
