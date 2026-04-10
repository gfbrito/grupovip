'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Settings,
    Trash2,
    Save,
    Archive,
    AlertTriangle
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function LaunchSettingsPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [launch, setLaunch] = useState<any>(null);

    // Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        slug: '',
        status: '',
        memberLimit: 256,
        autoCreateGroup: true,
        autoCreateAt: 90,
        logoUrl: '',
    });

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/launches/${id}`);
            const l = response.data.launch;
            setLaunch(l);
            setFormData({
                name: l.name,
                description: l.description || '',
                slug: l.slug,
                status: l.status,
                memberLimit: l.memberLimit,
                autoCreateGroup: l.autoCreateGroup,
                autoCreateAt: l.autoCreateAt,
                logoUrl: l.logoUrl || '',
            });
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar configurações.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/launches/${id}`, formData);
            addToast({ type: 'success', title: 'Sucesso', message: 'Configurações atualizadas.' });
            const res = await api.get(`/launches/${id}`);
            setLaunch(res.data.launch);
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao salvar.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        // Remover o prompt complexo, usar modal direto
        setIsDeleting(true);
        try {
            await api.delete(`/launches/${id}`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Lançamento excluído.' });
            router.push('/launches');
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao excluir lançamento.' });
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
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

            <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-8">
                <Card>
                    <Card.Header>
                        <h3 className="font-semibold text-slate-900">Informações Básicas</h3>
                    </Card.Header>
                    <Card.Body className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Lançamento</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="DRAFT">Rascunho</option>
                                    <option value="ACTIVE">Ativo (Público)</option>
                                    <option value="PAUSED">Pausado (Redireciona para aviso)</option>
                                    <option value="ENDED">Encerrado</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">URL da Logo (Opcional)</label>
                            <Input
                                value={formData.logoUrl || ''}
                                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                placeholder="https://exemplo.com/logo.png"
                            />
                            <p className="text-xs text-slate-500 mt-1">Recomendado: Imagem quadrada (ex: 500x500px).</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL Pública)</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                                    {window.location.origin}/l/
                                </span>
                                <input
                                    type="text"
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                />
                            </div>
                            <p className="text-xs text-yellow-600 mt-1">
                                Cuidado: Alterar o slug fará com que links antigos deixem de funcionar.
                            </p>
                        </div>
                    </Card.Body>
                </Card>

                <Card>
                    <Card.Header>
                        <h3 className="font-semibold text-slate-900">Configuração de Grupos</h3>
                    </Card.Header>
                    <Card.Body className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Limite de Membros por Grupo</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="1024"
                                    value={formData.memberLimit}
                                    onChange={(e) => setFormData({ ...formData, memberLimit: parseInt(e.target.value) || 0 })}
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">Quando atingir este número, o redirecionador enviará para o próximo grupo.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Gatilho de Criação Automática (%)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={formData.autoCreateAt}
                                    onChange={(e) => setFormData({ ...formData, autoCreateAt: parseInt(e.target.value) || 0 })}
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">Criar novos grupos quando a capacidade dos atuais atingir X%.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="autoCreate"
                                checked={formData.autoCreateGroup}
                                onChange={(e) => setFormData({ ...formData, autoCreateGroup: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="autoCreate" className="text-sm font-medium text-slate-700">
                                Habilitar criação automática de grupos
                            </label>
                        </div>
                    </Card.Body>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button type="submit" disabled={saving} className="w-full md:w-auto">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </form>

            <div className="mt-12 border-t border-slate-200 pt-8">
                <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Zona de Perigo
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-semibold text-red-900">Excluir Lançamento</h4>
                        <p className="text-sm text-red-700 mt-1">
                            Esta ação é irreversível. Todos os dados serão perdidos.
                        </p>
                    </div>
                    <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Permanentemente
                    </Button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Excluir Lançamento"
                message={`Tem certeza que deseja excluir o lançamento "${launch.name}"? Esta ação é irreversível.`}
                confirmText="Sim, excluir tudo"
                isDestructive
                isLoading={isDeleting}
            />
        </div>
    );
}
