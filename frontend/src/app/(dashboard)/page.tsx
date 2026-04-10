'use client';

import { useState, useEffect } from 'react';
import {
    Users, Target, Zap, Clock, Activity, Rocket, ArrowUpRight, ArrowDownRight, Phone
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface DashboardStats {
    totalLaunches: number;
    totalGroups: number;
    totalClicks: number;
    totalLeads: number;
    activeLeads: number;
    retentionRate: string;
    conversionRate: string;
    chartData: Array<{
        date: string;
        entradas: number;
        saidas: number;
    }>;
}

export default function DashboardAnalyticsPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await api.get('/analytics/dashboard');
                setStats(response.data);
            } catch (error) {
                console.error('Erro ao carregar analytics', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
                    <p className="text-slate-500 mt-1">Bem vindo de volta, acompanhe suas conversões.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/launches" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2">
                        <Rocket className="w-4 h-4" />
                        Ver Lançamentos
                    </Link>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <Card.Body className="p-5">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <Badge variant="default">{stats.totalLaunches} Lançamentos</Badge>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-slate-500 font-medium">Leads Retidos (Ativos)</p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-2xl font-bold text-slate-900">{stats.activeLeads}</h3>
                                <span className="text-sm text-slate-400 mb-1">/ {stats.totalLeads} histórico</span>
                            </div>
                        </div>
                    </Card.Body>
                </Card>

                <Card>
                    <Card.Body className="p-5">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <Activity className="w-5 h-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-slate-500 font-medium">Taxa de Retenção</p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-2xl font-bold text-slate-900">{stats.retentionRate}%</h3>
                                <span className="text-sm text-emerald-500 font-medium flex items-center mb-1">
                                    Permanece no grupo
                                </span>
                            </div>
                        </div>
                    </Card.Body>
                </Card>

                <Card>
                    <Card.Body className="p-5">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Target className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="text-xs text-slate-400 font-medium">{stats.totalClicks} cliques</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-slate-500 font-medium">Conversão de Clique</p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-2xl font-bold text-slate-900">{stats.conversionRate}%</h3>
                            </div>
                        </div>
                    </Card.Body>
                </Card>

                <Card>
                    <Card.Body className="p-5">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Phone className="w-5 h-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-slate-500 font-medium">Grupos Gerenciados</p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-2xl font-bold text-slate-900">{stats.totalGroups}</h3>
                            </div>
                        </div>
                    </Card.Body>
                </Card>
            </div>

            {/* Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <Card.Header>
                            <h2 className="font-semibold text-slate-900">Fluxo de Participantes (Últimos 14 dias)</h2>
                            <p className="text-sm text-slate-500">Entradas vs Saídas nos seus grupos</p>
                        </Card.Header>
                        <Card.Body className="min-h-[350px]">
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 12, fill: '#64748b' }} 
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        <Area 
                                            type="monotone" 
                                            name="Entradas"
                                            dataKey="entradas" 
                                            stroke="#10b981" 
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorEntradas)" 
                                        />
                                        <Area 
                                            type="monotone" 
                                            name="Saídas"
                                            dataKey="saidas" 
                                            stroke="#ef4444" 
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorSaidas)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card.Body>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card className="h-full">
                        <Card.Header>
                            <h2 className="font-semibold text-slate-900">Resumo do Funil</h2>
                        </Card.Header>
                        <Card.Body className="space-y-6">
                            
                            <div className="relative">
                                {/* Funnel Steps */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                1
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">Visualizações / Cliques</p>
                                                <p className="text-xs text-slate-500">Tráfego recebido no link</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-slate-900">{stats.totalClicks}</span>
                                    </div>

                                    <div className="flex items-center justify-between pl-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                2
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">Total de Entradas</p>
                                                <p className="text-xs text-slate-500">Leads que abriram o Wpp</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-slate-900">{stats.totalLeads}</span>
                                    </div>

                                    <div className="flex items-center justify-between pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                3
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">Retidos Hoje</p>
                                                <p className="text-xs text-slate-500">Aguardando o lançamento</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-emerald-600">{stats.activeLeads}</span>
                                    </div>
                                </div>
                                {/* Funnel Path Visual */}
                                <div className="absolute top-10 left-5 w-0.5 h-[120px] bg-slate-100 -z-10"></div>
                                <div className="absolute top-[90px] left-9 w-0.5 h-[50px] bg-slate-100 -z-10"></div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
}
