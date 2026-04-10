'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Crown,
    Users,
    Rocket,
    MessageSquare,
    Wifi,
    Sparkles,
    Edit,
    Trash2,
    Plus,
    Check,
    X,
    Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

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
    price: number;
    billingPeriod: string;
    _count?: { users: number };
}

export default function AdminPlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [showNewPlanForm, setShowNewPlanForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const { user } = useAuth();
    const router = useRouter();
    const toast = useToast();

    // Verificar se é MASTER
    useEffect(() => {
        if (user && user.role !== 'MASTER') {
            toast.error('Acesso negado. Apenas administradores MASTER podem acessar esta página.');
            router.push('/');
        }
    }, [user, router, toast]);

    const fetchPlans = useCallback(async () => {
        try {
            const response = await api.get('/plans');
            setPlans(response.data);
        } catch (error) {
            toast.error('Erro ao carregar planos');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Carregar planos
    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const handleSavePlan = async (plan: Partial<Plan>) => {
        setSaving(true);
        try {
            if (editingPlan?.id) {
                await api.put(`/plans/${editingPlan.id}`, plan);
                toast.success('Plano atualizado com sucesso');
            } else {
                await api.post('/plans', plan);
                toast.success('Plano criado com sucesso');
            }
            setEditingPlan(null);
            setShowNewPlanForm(false);
            fetchPlans();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar plano');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePlan = async (planId: number) => {
        if (!confirm('Tem certeza que deseja excluir este plano?')) return;

        try {
            await api.delete(`/plans/${planId}`);
            toast.success('Plano excluído com sucesso');
            fetchPlans();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao excluir plano');
        }
    };

    if (user?.role !== 'MASTER') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Crown className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900">Acesso Restrito</h2>
                    <p className="text-slate-500 mt-2">Apenas administradores MASTER podem acessar esta página.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Crown className="w-7 h-7 text-amber-500" />
                        Gerenciamento de Planos
                    </h1>
                    <p className="text-slate-500 mt-1">Gerencie os planos de assinatura do sistema</p>
                </div>
                <button
                    onClick={() => setShowNewPlanForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Novo Plano
                </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        onEdit={() => setEditingPlan(plan)}
                        onDelete={() => handleDeletePlan(plan.id)}
                    />
                ))}
            </div>

            {/* Edit/Create Modal */}
            {(editingPlan || showNewPlanForm) && (
                <PlanFormModal
                    plan={editingPlan}
                    onSave={handleSavePlan}
                    onClose={() => {
                        setEditingPlan(null);
                        setShowNewPlanForm(false);
                    }}
                    saving={saving}
                />
            )}
        </div>
    );
}

function PlanCard({ plan, onEdit, onDelete }: { plan: Plan; onEdit: () => void; onDelete: () => void }) {
    const formatNumber = (num: number) => {
        if (num >= 999999) return '∞';
        if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
        return num.toString();
    };

    const getPlanColor = (name: string) => {
        switch (name) {
            case 'FREE': return 'from-slate-500 to-slate-600';
            case 'STARTER': return 'from-blue-500 to-blue-600';
            case 'PRO': return 'from-purple-500 to-purple-600';
            case 'ENTERPRISE': return 'from-amber-500 to-amber-600';
            default: return 'from-slate-500 to-slate-600';
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${getPlanColor(plan.name)} px-6 py-4`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">{plan.displayName}</h3>
                        <p className="text-white/80 text-sm">{plan.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-white">R${plan.price}</p>
                        <p className="text-white/80 text-xs">/{plan.billingPeriod === 'MONTHLY' ? 'mês' : 'ano'}</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                        <Rocket className="w-4 h-4" />
                        Lançamentos
                    </span>
                    <span className="font-semibold text-slate-900">{formatNumber(plan.maxLaunches)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4" />
                        Grupos/Lançamento
                    </span>
                    <span className="font-semibold text-slate-900">{formatNumber(plan.maxGroupsPerLaunch)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                        <MessageSquare className="w-4 h-4" />
                        Leads
                    </span>
                    <span className="font-semibold text-slate-900">{formatNumber(plan.maxLeads)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                        <Wifi className="w-4 h-4" />
                        WhatsApp
                    </span>
                    <span className="font-semibold text-slate-900">{formatNumber(plan.maxWhatsAppServers)}</span>
                </div>

                {/* Features */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                    <FeatureRow enabled={plan.aiEnabled} label="IA de Respostas" />
                    <FeatureRow enabled={plan.privateMessagesEnabled} label="Mensagens Privadas" />
                    <FeatureRow enabled={plan.webhooksEnabled} label="Webhooks" />
                </div>

                {/* Users count */}
                <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        <span className="font-semibold text-slate-900">{plan._count?.users || 0}</span> usuários
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        Editar
                    </button>
                    {plan.name !== 'FREE' && (
                        <button
                            onClick={onDelete}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FeatureRow({ enabled, label }: { enabled: boolean; label: string }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            {enabled ? (
                <Check className="w-4 h-4 text-green-500" />
            ) : (
                <X className="w-4 h-4 text-slate-300" />
            )}
            <span className={enabled ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
        </div>
    );
}

function PlanFormModal({
    plan,
    onSave,
    onClose,
    saving,
}: {
    plan: Plan | null;
    onSave: (plan: Partial<Plan>) => void;
    onClose: () => void;
    saving: boolean;
}) {
    const [formData, setFormData] = useState({
        name: plan?.name || '',
        displayName: plan?.displayName || '',
        maxLaunches: plan?.maxLaunches || 1,
        maxGroupsPerLaunch: plan?.maxGroupsPerLaunch || 3,
        maxLeads: plan?.maxLeads || 500,
        maxWhatsAppServers: plan?.maxWhatsAppServers || 1,
        aiEnabled: plan?.aiEnabled || false,
        privateMessagesEnabled: plan?.privateMessagesEnabled || false,
        webhooksEnabled: plan?.webhooksEnabled || false,
        price: plan?.price || 0,
        billingPeriod: plan?.billingPeriod || 'MONTHLY',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">
                        {plan ? 'Editar Plano' : 'Novo Plano'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Identificador
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="CUSTOM"
                                disabled={!!plan}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome de Exibição
                            </label>
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Personalizado"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Preço (R$)
                            </label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Período
                            </label>
                            <select
                                value={formData.billingPeriod}
                                onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="MONTHLY">Mensal</option>
                                <option value="YEARLY">Anual</option>
                            </select>
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 pt-4">Limites</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Lançamentos
                            </label>
                            <input
                                type="number"
                                value={formData.maxLaunches}
                                onChange={(e) => setFormData({ ...formData, maxLaunches: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Grupos/Lançamento
                            </label>
                            <input
                                type="number"
                                value={formData.maxGroupsPerLaunch}
                                onChange={(e) => setFormData({ ...formData, maxGroupsPerLaunch: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Leads
                            </label>
                            <input
                                type="number"
                                value={formData.maxLeads}
                                onChange={(e) => setFormData({ ...formData, maxLeads: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Conexões WhatsApp
                            </label>
                            <input
                                type="number"
                                value={formData.maxWhatsAppServers}
                                onChange={(e) => setFormData({ ...formData, maxWhatsAppServers: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 pt-4">Features</h3>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.aiEnabled}
                                onChange={(e) => setFormData({ ...formData, aiEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">IA de Respostas</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.privateMessagesEnabled}
                                onChange={(e) => setFormData({ ...formData, privateMessagesEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">Mensagens Privadas</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.webhooksEnabled}
                                onChange={(e) => setFormData({ ...formData, webhooksEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">Webhooks</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {plan ? 'Salvar' : 'Criar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
