'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Plus,
    Calendar,
    Image as ImageIcon,
    Type,
    AlignLeft,
    Lock,
    Unlock,
    Play,
    XCircle,
    Clock
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

export default function LaunchActionsPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<any>(null);
    const [actions, setActions] = useState<any[]>([]);

    // Create Form State
    const [isCreating, setIsCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        type: 'CHANGE_NAME',
        scheduledAt: '',
        config: {
            name: '',
            description: '',
            imageUrl: '',
        },
        applyToAll: true,
    });

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [launchRes, actionsRes] = await Promise.all([
                api.get(`/launches/${id}`),
                api.get(`/launches/${id}/actions`),
            ]);

            setLaunch(launchRes.data.launch);
            setActions(actionsRes.data.actions);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Falha ao carregar ações.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        try {
            // Validar data
            if (new Date(formData.scheduledAt) <= new Date()) {
                addToast({ type: 'warning', title: 'Atenção', message: 'A data deve ser futura.' });
                setIsCreating(false);
                return;
            }

            await api.post(`/launches/${id}/actions`, {
                type: formData.type,
                scheduledAt: formData.scheduledAt,
                config: JSON.stringify(formData.config),
                applyToAll: formData.applyToAll,
            });

            addToast({
                type: 'success',
                title: 'Sucesso',
                message: 'Ação agendada com sucesso.',
            });

            setShowForm(false);
            setFormData({
                type: 'CHANGE_NAME',
                scheduledAt: '',
                config: { name: '', description: '', imageUrl: '' },
                applyToAll: true,
            });
            fetchData();
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao agendar ação.',
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCancel = async (actionId: number) => {
        if (!confirm('Tem certeza que deseja cancelar esta ação?')) return;
        try {
            await api.post(`/launches/${id}/actions/${actionId}/cancel`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Ação cancelada.' });
            fetchData();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao cancelar ação.' });
        }
    };

    const statusColors = {
        SCHEDULED: 'success', // Blue/Info actually usually, but Badge supports variants
        RUNNING: 'warning',
        COMPLETED: 'default',
        FAILED: 'destructive',
        CANCELED: 'secondary',
    };

    const typeIcons: any = {
        CHANGE_PHOTO: ImageIcon,
        CHANGE_NAME: Type,
        CHANGE_DESCRIPTION: AlignLeft,
        LOCK_MESSAGES: Lock,
        UNLOCK_MESSAGES: Unlock,
    };

    const typeLabels: any = {
        CHANGE_PHOTO: 'Alterar Foto',
        CHANGE_NAME: 'Alterar Nome',
        CHANGE_DESCRIPTION: 'Alterar Descrição',
        LOCK_MESSAGES: 'Trancar Grupo',
        UNLOCK_MESSAGES: 'Destrancar Grupo',
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

            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Ações Agendadas</h2>
                    <p className="text-sm text-slate-500">
                        Automatize alterações nos grupos (nome, foto, desc, permissões).
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Ação
                </Button>
            </div>

            {showForm && (
                <Card className="mb-8 border-indigo-100 shadow-md">
                    <Card.Header className="bg-indigo-50/50">
                        <h3 className="font-semibold text-indigo-900">Agendar Nova Ação</h3>
                    </Card.Header>
                    <Card.Body>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Ação</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="CHANGE_NAME">Alterar Nome do Grupo</option>
                                        <option value="CHANGE_DESCRIPTION">Alterar Descrição</option>
                                        <option value="CHANGE_PHOTO">Alterar Foto (Ícone)</option>
                                        <option value="LOCK_MESSAGES">Trancar Mensagens (Apenas Adm)</option>
                                        <option value="UNLOCK_MESSAGES">Destrancar Mensagens (Todos)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data e Hora</label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.scheduledAt}
                                        onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Campos Dinâmicos baseados no Tipo */}
                            {formData.type === 'CHANGE_NAME' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Novo Nome</label>
                                    <Input
                                        placeholder="Ex: {nome} - Aula Liberada!"
                                        value={formData.config.name}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            config: { ...formData.config, name: e.target.value }
                                        })}
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Variáveis disponíveis: {'{nome}'}, {'{n}'}, {'{data}'}, {'{hora}'}</p>
                                </div>
                            )}

                            {formData.type === 'CHANGE_DESCRIPTION' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nova Descrição</label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        rows={4}
                                        value={formData.config.description}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            config: { ...formData.config, description: e.target.value }
                                        })}
                                        placeholder="Cole aqui a nova descrição..."
                                    />
                                </div>
                            )}

                            {formData.type === 'CHANGE_PHOTO' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem</label>
                                    <Input
                                        placeholder="https://exemplo.com/imagem.jpg"
                                        value={formData.config.imageUrl}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            config: { ...formData.config, imageUrl: e.target.value }
                                        })}
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-1">A imagem deve ser pública e direta (JPG/PNG).</p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="applyAll"
                                    checked={formData.applyToAll}
                                    onChange={(e) => setFormData({ ...formData, applyToAll: e.target.checked })}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="applyAll" className="text-sm text-slate-700">Aplicar a todos os grupos (incluindo futuros)</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? 'Agendando...' : 'Agendar Ação'}
                                </Button>
                            </div>
                        </form>
                    </Card.Body>
                </Card>
            )}

            <div className="space-y-4">
                {actions.length === 0 ? (
                    <Card className="p-8 text-center text-slate-500">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p>Nenhuma ação agendada.</p>
                    </Card>
                ) : (
                    actions.map((action) => {
                        const Icon = typeIcons[action.type] || Calendar;
                        return (
                            <Card key={action.id} className="hover:border-indigo-200 transition-colors">
                                <Card.Body className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 w-full">
                                        <div className={`p-3 rounded-xl bg-slate-100 text-slate-600`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900">{typeLabels[action.type] || action.type}</h4>
                                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {new Date(action.scheduledAt).toLocaleString()}
                                                <span className="text-slate-300">|</span>
                                                {action.applyToAll ? 'Todos os Grupos' : 'Grupos Selecionados'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                        <Badge variant={statusColors[action.status as keyof typeof statusColors] as any}>
                                            {action.status}
                                        </Badge>

                                        {action.status === 'SCHEDULED' && (
                                            <Button variant="ghost" size="sm" onClick={() => handleCancel(action.id)} className="text-red-500 hover:text-red-700">
                                                <XCircle className="w-5 h-5" />
                                            </Button>
                                        )}

                                        {/* Botão de executar agora (opcional) vai aqui se necessário */}
                                    </div>
                                </Card.Body>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
