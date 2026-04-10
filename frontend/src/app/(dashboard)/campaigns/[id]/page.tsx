'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import WhatsAppText from '@/components/ui/WhatsAppText';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';

interface Job {
    id: number;
    status: string;
    attempts: number;
    lastError: string | null;
    processedAt: string | null;
    group: {
        id: number;
        name: string;
        nickname: string | null;
    };
}

interface Log {
    id: number;
    type: string;
    message: string;
    createdAt: string;
}

interface Campaign {
    id: number;
    name: string;
    message: string;
    status: string;
    createdAt: string;
    jobs: Job[];
    logs: Log[];
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
    DRAFT: { label: 'Rascunho', variant: 'default' },
    SCHEDULED: { label: 'Agendada', variant: 'info' },
    RUNNING: { label: 'Em execução', variant: 'warning' },
    PAUSED: { label: 'Pausada', variant: 'default' },
    COMPLETED: { label: 'Concluída', variant: 'success' },
    FAILED: { label: 'Falhou', variant: 'error' },
};

const jobStatusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    PENDING: { label: 'Aguardando', icon: <Clock className="w-4 h-4" />, color: 'text-slate-500' },
    PROCESSING: { label: 'Enviando', icon: <AlertCircle className="w-4 h-4" />, color: 'text-amber-500' },
    COMPLETED: { label: 'Enviado', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500' },
    FAILED: { label: 'Falhou', icon: <XCircle className="w-4 h-4" />, color: 'text-red-500' },
};

export default function CampaignDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);

    const toast = useToast();
    const campaignId = params.id as string;

    const fetchCampaign = useCallback(async () => {
        try {
            const response = await api.get(`/campaigns/${campaignId}`);
            setCampaign(response.data.campaign);
        } catch (error) {
            console.error('Erro ao carregar campanha:', error);
            toast.error('Campanha não encontrada');
            router.push('/campaigns');
        } finally {
            setLoading(false);
        }
    }, [campaignId, router, toast]);

    useEffect(() => {
        fetchCampaign();
        const interval = setInterval(fetchCampaign, 5000);
        return () => clearInterval(interval);
    }, [fetchCampaign]);

    const handleStart = async () => {
        try {
            await api.post(`/campaigns/${campaignId}/start`);
            toast.success('Campanha iniciada');
            fetchCampaign();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao iniciar campanha');
        }
    };

    const handlePause = async () => {
        try {
            await api.post(`/campaigns/${campaignId}/pause`);
            toast.success('Campanha pausada');
            fetchCampaign();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao pausar campanha');
        }
    };

    if (loading || !campaign) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const config = statusConfig[campaign.status] || statusConfig.DRAFT;
    const completedJobs = campaign.jobs.filter((j) => j.status === 'COMPLETED').length;
    const failedJobs = campaign.jobs.filter((j) => j.status === 'FAILED').length;
    const progress = campaign.jobs.length > 0
        ? Math.round(((completedJobs + failedJobs) / campaign.jobs.length) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push('/campaigns')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
                            <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                        <p className="text-slate-500 mt-1">
                            Criada em {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {campaign.status === 'RUNNING' ? (
                        <Button variant="secondary" onClick={handlePause}>
                            <Pause className="w-4 h-4 mr-2" />
                            Pausar
                        </Button>
                    ) : campaign.status !== 'COMPLETED' && campaign.status !== 'FAILED' ? (
                        <Button onClick={handleStart}>
                            <Play className="w-4 h-4 mr-2" />
                            Iniciar
                        </Button>
                    ) : null}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <Card.Body className="text-center py-4">
                        <p className="text-2xl font-bold text-slate-900">{campaign.jobs.length}</p>
                        <p className="text-sm text-slate-500">Total</p>
                    </Card.Body>
                </Card>
                <Card>
                    <Card.Body className="text-center py-4">
                        <p className="text-2xl font-bold text-green-600">{completedJobs}</p>
                        <p className="text-sm text-slate-500">Enviados</p>
                    </Card.Body>
                </Card>
                <Card>
                    <Card.Body className="text-center py-4">
                        <p className="text-2xl font-bold text-red-600">{failedJobs}</p>
                        <p className="text-sm text-slate-500">Falhas</p>
                    </Card.Body>
                </Card>
                <Card>
                    <Card.Body className="text-center py-4">
                        <p className="text-2xl font-bold text-blue-600">{progress}%</p>
                        <p className="text-sm text-slate-500">Progresso</p>
                    </Card.Body>
                </Card>
            </div>

            {/* Mensagem */}
            <Card>
                <Card.Header>
                    <h2 className="font-semibold text-slate-900">Mensagem</h2>
                </Card.Header>
                <Card.Body className="bg-[#e5ddd5]">
                    <div className="bg-[#dcf8c6] rounded-lg p-4 shadow-sm max-w-[85%]">
                        <WhatsAppText text={campaign.message} className="text-slate-800" />
                    </div>
                </Card.Body>
            </Card>

            {/* Jobs */}
            <Card>
                <Card.Header>
                    <h2 className="font-semibold text-slate-900">Grupos ({campaign.jobs.length})</h2>
                </Card.Header>
                <Card.Body className="p-0">
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {campaign.jobs.map((job) => {
                            const jobConfig = jobStatusConfig[job.status] || jobStatusConfig.PENDING;
                            return (
                                <div key={job.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50">
                                    <div className={jobConfig.color}>{jobConfig.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 truncate">
                                            {job.group.nickname || job.group.name}
                                        </p>
                                        {job.lastError && (
                                            <p className="text-xs text-red-500 truncate">{job.lastError}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={jobConfig.color.includes('green') ? 'success' : jobConfig.color.includes('red') ? 'error' : 'default'}>
                                            {jobConfig.label}
                                        </Badge>
                                        {job.processedAt && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(job.processedAt).toLocaleTimeString('pt-BR')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card.Body>
            </Card>

            {/* Logs */}
            {campaign.logs.length > 0 && (
                <Card>
                    <Card.Header>
                        <h2 className="font-semibold text-slate-900">Logs Recentes</h2>
                    </Card.Header>
                    <Card.Body className="p-0">
                        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                            {campaign.logs.map((log) => (
                                <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                                    {log.type === 'SUCCESS' && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
                                    {log.type === 'ERROR' && <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                                    {log.type === 'WARNING' && <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />}
                                    {log.type === 'INFO' && <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />}
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{log.message}</p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(log.createdAt).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card.Body>
                </Card>
            )}
        </div>
    );
}
