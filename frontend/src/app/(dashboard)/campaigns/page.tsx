'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Send, Pause, Play, Trash2, Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import WhatsAppText from '@/components/ui/WhatsAppText';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';

interface CampaignStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}

interface Campaign {
    id: number;
    name: string;
    message: string;
    status: string;
    scheduledAt: string | null;
    createdAt: string;
    stats: CampaignStats;
    _count: { jobs: number };
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
    DRAFT: { label: 'Rascunho', variant: 'default' },
    SCHEDULED: { label: 'Agendada', variant: 'info' },
    RUNNING: { label: 'Em execução', variant: 'warning' },
    PAUSED: { label: 'Pausada', variant: 'default' },
    COMPLETED: { label: 'Concluída', variant: 'success' },
    FAILED: { label: 'Falhou', variant: 'error' },
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const toast = useToast();

    const fetchCampaigns = useCallback(async () => {
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data.campaigns);
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const handleStart = async (id: number) => {
        try {
            await api.post(`/campaigns/${id}/start`);
            toast.success('Campanha iniciada');
            fetchCampaigns();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao iniciar campanha');
        }
    };

    const handlePause = async (id: number) => {
        try {
            await api.post(`/campaigns/${id}/pause`);
            toast.success('Campanha pausada');
            fetchCampaigns();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao pausar campanha');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;

        try {
            await api.delete(`/campaigns/${id}`);
            toast.success('Campanha excluída');
            fetchCampaigns();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao excluir campanha');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Campanhas</h1>
                    <p className="text-slate-500 mt-1">Gerencie suas campanhas de mensagens</p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Campanha
                </Button>
            </div>

            {/* Modal de criação */}
            {showForm && (
                <CampaignForm
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        fetchCampaigns();
                    }}
                />
            )}

            {/* Lista de campanhas */}
            {campaigns.length === 0 ? (
                <Card>
                    <Card.Body className="py-12 text-center">
                        <Send className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma campanha</h3>
                        <p className="text-slate-500 mb-4">Crie sua primeira campanha para enviar mensagens</p>
                        <Button onClick={() => setShowForm(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Campanha
                        </Button>
                    </Card.Body>
                </Card>
            ) : (
                <div className="space-y-4">
                    {campaigns.map((campaign) => {
                        const config = statusConfig[campaign.status] || statusConfig.DRAFT;
                        const progress =
                            campaign.stats.completed + campaign.stats.failed > 0
                                ? Math.round(
                                    ((campaign.stats.completed + campaign.stats.failed) / campaign._count.jobs) * 100
                                )
                                : 0;

                        return (
                            <Card key={campaign.id}>
                                <Card.Body>
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-slate-900 truncate">{campaign.name}</h3>
                                                <Badge variant={config.variant}>{config.label}</Badge>
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-1 mb-2">{campaign.message}</p>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                                                </span>
                                                <span>{campaign._count.jobs} grupos</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1 text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                {campaign.stats.completed}
                                            </div>
                                            <div className="flex items-center gap-1 text-red-600">
                                                <XCircle className="w-4 h-4" />
                                                {campaign.stats.failed}
                                            </div>
                                            <div className="flex items-center gap-1 text-amber-600">
                                                <AlertCircle className="w-4 h-4" />
                                                {campaign.stats.pending}
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        {campaign.status === 'RUNNING' && (
                                            <div className="w-32">
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-500 text-center mt-1">{progress}%</p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Link href={`/campaigns/${campaign.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </Link>

                                            {campaign.status === 'RUNNING' ? (
                                                <Button variant="ghost" size="sm" onClick={() => handlePause(campaign.id)}>
                                                    <Pause className="w-4 h-4" />
                                                </Button>
                                            ) : campaign.status !== 'COMPLETED' && campaign.status !== 'FAILED' ? (
                                                <Button variant="ghost" size="sm" onClick={() => handleStart(campaign.id)}>
                                                    <Play className="w-4 h-4" />
                                                </Button>
                                            ) : null}

                                            {campaign.status !== 'RUNNING' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(campaign.id)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Componente do formulário de campanha
function CampaignForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [groups, setGroups] = useState<{ id: number; name: string; nickname: string | null; isActive: boolean }[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const toast = useToast();

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await api.get('/groups');
                setGroups(response.data.groups.filter((g: any) => g.isActive));
            } catch (error) {
                console.error('Erro ao carregar grupos:', error);
            } finally {
                setLoadingGroups(false);
            }
        };
        fetchGroups();
    }, []);

    const handleToggleGroup = (id: number) => {
        setSelectedGroups((prev) =>
            prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedGroups.length === groups.length) {
            setSelectedGroups([]);
        } else {
            setSelectedGroups(groups.map((g) => g.id));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Digite o nome da campanha');
            return;
        }

        if (!message.trim()) {
            toast.error('Digite a mensagem');
            return;
        }

        if (selectedGroups.length === 0) {
            toast.error('Selecione pelo menos um grupo');
            return;
        }

        setLoading(true);

        try {
            await api.post('/campaigns', {
                name,
                message,
                groupIds: selectedGroups,
            });
            toast.success('Campanha criada com sucesso!');
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar campanha');
        } finally {
            setLoading(false);
        }
    };

    // Preview da mensagem com variáveis
    const previewMessage = message
        .replace(/{group_name}/gi, 'Nome do Grupo')
        .replace(/{date}/gi, new Date().toLocaleDateString('pt-BR'))
        .replace(/{time}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <Card.Header className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Nova Campanha</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        ✕
                    </button>
                </Card.Header>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <Card.Body className="space-y-4">
                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Nome da Campanha
                            </label>
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Promoção de Janeiro"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        {/* Mensagem */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Mensagem
                            </label>
                            <textarea
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                placeholder="Digite sua mensagem aqui..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                            <div className="text-xs text-slate-500 mt-1.5 space-y-1">
                                <p>Variáveis: {'{group_name}'}, {'{date}'}, {'{time}'}</p>
                                <p>Formatação: *negrito*, _itálico_, ~tachado~, `código`</p>
                            </div>
                        </div>

                        {/* Preview */}
                        {message && (
                            <div className="p-4 bg-[#e5ddd5] rounded-lg border border-[#d1c9bf]">
                                <p className="text-xs text-slate-500 mb-2">Prévia (como aparecerá no WhatsApp):</p>
                                <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm max-w-[85%] ml-auto">
                                    <WhatsAppText text={previewMessage} className="text-sm text-slate-800" />
                                </div>
                            </div>
                        )}

                        {/* Grupos */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-700">
                                    Grupos ({selectedGroups.length} selecionados)
                                </label>
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-sm text-blue-500 hover:text-blue-600"
                                >
                                    {selectedGroups.length === groups.length ? 'Desmarcar todos' : 'Selecionar todos'}
                                </button>
                            </div>

                            {loadingGroups ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                </div>
                            ) : groups.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">
                                    Nenhum grupo ativo encontrado. Sincronize os grupos primeiro.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                                    {groups.map((group) => (
                                        <label
                                            key={group.id}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedGroups.includes(group.id)
                                                ? 'bg-blue-50 border border-blue-200'
                                                : 'bg-white border border-slate-100 hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(group.id)}
                                                onChange={() => handleToggleGroup(group.id)}
                                                className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700 truncate">
                                                {group.nickname || group.name}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card.Body>

                    <Card.Footer className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={loading}>
                            Criar Campanha
                        </Button>
                    </Card.Footer>
                </form>
            </Card>
        </div>
    );
}
