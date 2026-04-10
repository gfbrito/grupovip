'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Webhook,
    BarChart,
    Settings,
    Plus,
    Trash2,
    CheckCircle,
    AlertCircle,
    Play
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

interface Launch {
    id: number;
    name: string;
    description: string | null;
    slug: string;
    logoUrl: string | null;
    status: string;
}

interface Webhook {
    id: number;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: string;
}

export default function LaunchIntegrationsPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);

    // Tracking State
    const [trackingData, setTrackingData] = useState({
        metaPixelEnabled: false,
        metaPixelId: '',
        metaPixelEvents: [] as string[],
        gtmEnabled: false,
        gtmId: '',
    });

    // Webhook Form State
    const [showWebhookForm, setShowWebhookForm] = useState(false);
    const [webhookForm, setWebhookForm] = useState({
        name: '',
        url: '',
        events: ['LEAD_ENTERED'],
    });

    const availableEvents = [
        { value: 'LEAD_ENTERED', label: 'Lead Entrou' },
        { value: 'LEAD_LEFT', label: 'Lead Saiu' },
        { value: 'GROUP_CREATED', label: 'Grupo Criado' },
        { value: 'MESSAGE_SENT', label: 'Mensagem Enviada' },
    ];

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [launchRes, webhooksRes] = await Promise.all([
                api.get(`/launches/${id}`),
                api.get(`/launches/${id}/webhooks`),
            ]);

            const l = launchRes.data.launch;
            setLaunch(l);
            setWebhooks(webhooksRes.data.webhooks);

            // Parse JSON events if needed, but prisma returns string? No backend parses.
            // Launch model has `metaPixelEvents` as string (JSON).
            setTrackingData({
                metaPixelEnabled: l.metaPixelEnabled,
                metaPixelId: l.metaPixelId || '',
                metaPixelEvents: l.metaPixelEvents ? JSON.parse(l.metaPixelEvents) : [],
                gtmEnabled: l.gtmEnabled,
                gtmId: l.gtmId || '',
            });

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Falha ao carregar integrações.',
            });
        } finally {
            setLoading(false);
        }
    }, [id, addToast]);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id, fetchData]);

    const handleSaveTracking = async () => {
        try {
            await api.put(`/launches/${id}`, {
                metaPixelEnabled: trackingData.metaPixelEnabled,
                metaPixelId: trackingData.metaPixelId,
                metaPixelEvents: JSON.stringify(trackingData.metaPixelEvents),
                gtmEnabled: trackingData.gtmEnabled,
                gtmId: trackingData.gtmId,
            });
            addToast({ type: 'success', title: 'Sucesso', message: 'Configurações salvas.' });
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar configurações.' });
        }
    };

    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/launches/${id}/webhooks`, {
                ...webhookForm,
                events: webhookForm.events, // Controller handles array
            });
            addToast({ type: 'success', title: 'Sucesso', message: 'Webhook criado.' });
            setWebhookForm({ name: '', url: '', events: ['LEAD_ENTERED'] });
            setShowWebhookForm(false);

            // Refresh webhooks
            const res = await api.get(`/launches/${id}/webhooks`);
            setWebhooks(res.data.webhooks);
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao criar webhook.' });
        }
    };

    const handleDeleteWebhook = async (webhookId: number) => {
        if (!confirm('Excluir webhook?')) return;
        try {
            await api.delete(`/launches/${id}/webhooks/${webhookId}`);
            setWebhooks(webhooks.filter(w => w.id !== webhookId));
            addToast({ type: 'success', title: 'Sucesso', message: 'Webhook removido.' });
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao remover webhook.' });
        }
    };

    const handleTestWebhook = async (webhookId: number) => {
        try {
            await api.post(`/launches/${id}/webhooks/${webhookId}/test`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Teste enviado.' });
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha no teste.' });
        }
    };

    const toggleEvent = (event: string) => {
        setWebhookForm(prev => {
            const exists = prev.events.includes(event);
            if (exists) return { ...prev, events: prev.events.filter(e => e !== event) };
            return { ...prev, events: [...prev.events, event] };
        });
    };

    if (loading && !launch) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {launch && <LaunchHeader launch={launch} />}
            <LaunchTabs launchId={id} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tracking Settings */}
                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <BarChart className="w-5 h-5 text-indigo-600" />
                        Rastreamento
                    </h2>

                    <Card>
                        <Card.Header>
                            <div className="flex items-center justify-between w-full">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <span className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">f</span>
                                    Meta Pixel (Facebook)
                                </h3>
                                <div className="flex items-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={trackingData.metaPixelEnabled}
                                            onChange={(e) => setTrackingData({ ...trackingData, metaPixelEnabled: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body className="space-y-4">
                            <div className={trackingData.metaPixelEnabled ? '' : 'opacity-50 pointer-events-none'}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pixel ID</label>
                                <Input
                                    value={trackingData.metaPixelId}
                                    onChange={(e) => setTrackingData({ ...trackingData, metaPixelId: e.target.value })}
                                    placeholder="1234567890"
                                />
                            </div>
                        </Card.Body>
                    </Card>

                    <Card>
                        <Card.Header>
                            <div className="flex items-center justify-between w-full">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <span className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">G</span>
                                    Google Tag Manager
                                </h3>
                                <div className="flex items-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={trackingData.gtmEnabled}
                                            onChange={(e) => setTrackingData({ ...trackingData, gtmEnabled: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                    </label>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body className="space-y-4">
                            <div className={trackingData.gtmEnabled ? '' : 'opacity-50 pointer-events-none'}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">GTM Container ID</label>
                                <Input
                                    value={trackingData.gtmId}
                                    onChange={(e) => setTrackingData({ ...trackingData, gtmId: e.target.value })}
                                    placeholder="GTM-XXXXXX"
                                />
                            </div>
                        </Card.Body>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveTracking}>Salvar Configurações</Button>
                    </div>
                </div>

                {/* Webhooks Settings */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Webhook className="w-5 h-5 text-indigo-600" />
                            Webhooks de Saída
                        </h2>
                        <Button size="sm" onClick={() => setShowWebhookForm(!showWebhookForm)}>
                            <Plus className="w-4 h-4 mr-2" /> Novo
                        </Button>
                    </div>

                    {showWebhookForm && (
                        <Card className="border-indigo-100 shadow-md">
                            <Card.Header className="bg-indigo-50/50">
                                <h3 className="font-semibold text-indigo-900">Novo Webhook</h3>
                            </Card.Header>
                            <Card.Body>
                                <form onSubmit={handleCreateWebhook} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                        <Input
                                            value={webhookForm.name}
                                            onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                                            placeholder="Ex: Integração Zapier"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">URL de Destino</label>
                                        <Input
                                            value={webhookForm.url}
                                            onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                                            placeholder="https://hooks.zapier.com/..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Eventos</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableEvents.map(evt => (
                                                <label key={evt.value} className="flex items-center p-2 border rounded hover:bg-slate-50 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={webhookForm.events.includes(evt.value)}
                                                        onChange={() => toggleEvent(evt.value)}
                                                        className="rounded text-indigo-600 mr-2"
                                                    />
                                                    <span className="text-sm">{evt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="ghost" type="button" onClick={() => setShowWebhookForm(false)}>Cancelar</Button>
                                        <Button type="submit">Criar Webhook</Button>
                                    </div>
                                </form>
                            </Card.Body>
                        </Card>
                    )}

                    <div className="space-y-3">
                        {webhooks.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 rounded-lg text-slate-500 text-sm border border-dashed border-slate-200">
                                Nenhum webhook configurado.
                            </div>
                        ) : (
                            webhooks.map(webhook => (
                                <Card key={webhook.id}>
                                    <div className="p-4 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-slate-900">{webhook.name}</h4>
                                                <Badge variant={webhook.isActive ? 'success' : 'default'} className="text-[10px] py-0">
                                                    {webhook.isActive ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px] xl:max-w-xs">{webhook.url}</p>
                                            <div className="flex gap-1 mt-2">
                                                {JSON.parse(webhook.events).map((evt: string) => (
                                                    <span key={evt} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                        {evt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleTestWebhook(webhook.id)} title="Testar">
                                                <Play className="w-4 h-4 text-green-600" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook.id)} title="Excluir" className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
