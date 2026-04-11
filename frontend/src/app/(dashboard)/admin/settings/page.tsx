'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';

export default function MasterSettingsPage() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        paypalClientId: '',
        paypalSecret: '',
        paypalWebhookId: '',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPass: '',
        enableAI: true,
        evolutionUrl: '',
        evolutionKey: '',
        instanceName: '',
        aiProvider: 'OPENAI',
        aiModel: '',
        aiApiKey: '',
        aiSystemPrompt: '',
    });

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/config');
            setConfig({
                paypalClientId: data.paypalClientId || '',
                paypalSecret: data.paypalSecret || '',
                paypalWebhookId: data.paypalWebhookId || '',
                smtpHost: data.smtpHost || '',
                smtpPort: data.smtpPort || '',
                smtpUser: data.smtpUser || '',
                smtpPass: data.smtpPass || '',
                enableAI: data.enableAI !== undefined ? data.enableAI : true,
                evolutionUrl: data.evolutionUrl || '',
                evolutionKey: data.evolutionKey || '',
                instanceName: data.instanceName || '',
                aiProvider: data.aiConfig?.provider || 'OPENAI',
                aiModel: data.aiConfig?.model || '',
                aiApiKey: data.aiConfig?.apiKey || '',
                aiSystemPrompt: data.aiConfig?.systemPrompt || '',
            });
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar configurações do sistema.' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/admin/config', config);
            addToast({ type: 'success', title: 'Sucesso', message: 'Configurações globais salvas com segurança.' });
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', message: 'Não foi possível salvar as configurações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-6 py-1">
                        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                        <div className="space-y-3">
                            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Cofre do Sistema (Master)</h1>
                <p className="text-slate-500">Gerencie as credenciais globais de Pagamento e E-mail Transacional.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                
                {/* AI TOGGLE BOX */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={config.enableAI}
                                onChange={(e) => setConfig({...config, enableAI: e.target.checked})}
                            />
                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                            🤖
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Módulo de Inteligência Artificial</h2>
                            <p className="text-sm text-slate-500">Habilite ou desabilite o processamento de IA em toda a plataforma.</p>
                        </div>
                    </div>
                </div>

                {/* WHATSAPP INFRASTRUCTURE BOX */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center text-xl">
                            🌐
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Infraestrutura WhatsApp (Padrão Global)</h2>
                            <p className="text-sm text-slate-500">Configuração herdada automaticamente por novas conexões de clientes.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">URL da API Evolution</label>
                            <Input 
                                placeholder="https://api.seuservidor.com" 
                                value={config.evolutionUrl}
                                onChange={(e) => setConfig({...config, evolutionUrl: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">API Key Global</label>
                            <Input 
                                type="password"
                                placeholder={config.evolutionKey ? '******** (Salva)' : 'Chave da API...'}
                                value={config.evolutionKey === '********' ? '' : config.evolutionKey}
                                onChange={(e) => setConfig({...config, evolutionKey: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Instância de Teste</label>
                            <Input 
                                placeholder="ex: main" 
                                value={config.instanceName}
                                onChange={(e) => setConfig({...config, instanceName: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* AI ADVANCED BOX */}
                {config.enableAI && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                                🤖
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">Configurações de IA Avançadas</h2>
                                <p className="text-sm text-slate-500">Defina o provedor e as credenciais globais para a plataforma.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Provedor</label>
                                <select 
                                    className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={config.aiProvider}
                                    onChange={(e) => setConfig({...config, aiProvider: e.target.value})}
                                >
                                    <option value="OPENAI">OpenAI</option>
                                    <option value="GEMINI">Google Gemini</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                                <Input 
                                    placeholder="ex: gpt-4o-mini" 
                                    value={config.aiModel}
                                    onChange={(e) => setConfig({...config, aiModel: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key de IA</label>
                                <Input 
                                    type="password"
                                    placeholder={config.aiApiKey ? '******** (Salva)' : 'Sua chave de API...'}
                                    value={config.aiApiKey === '********' ? '' : config.aiApiKey}
                                    onChange={(e) => setConfig({...config, aiApiKey: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt Global</label>
                                <textarea 
                                    className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm"
                                    placeholder="Instruções para o comportamento da IA..."
                                    value={config.aiSystemPrompt}
                                    onChange={(e) => setConfig({...config, aiSystemPrompt: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                )}
                </div>

                {/* SMTP BOX */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                            📧
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Servidor de E-mails (SMTP)</h2>
                            <p className="text-sm text-slate-500">Usado para enviar e-mails de recuperação de senha e faturas.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Host SMTP</label>
                            <Input 
                                placeholder="ex: smtp.sendgrid.net" 
                                value={config.smtpHost}
                                onChange={(e) => setConfig({...config, smtpHost: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Porta SMTP</label>
                            <Input 
                                placeholder="ex: 587" 
                                value={config.smtpPort}
                                onChange={(e) => setConfig({...config, smtpPort: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Usuário SMTP / API Key</label>
                            <Input 
                                placeholder="Usuário" 
                                value={config.smtpUser}
                                onChange={(e) => setConfig({...config, smtpUser: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Senha SMTP / Secret</label>
                            <Input 
                                type="password"
                                placeholder={config.smtpPass ? '******** (Salvo)' : 'Digite a senha...'}
                                value={config.smtpPass === '********' ? '' : config.smtpPass}
                                onChange={(e) => setConfig({...config, smtpPass: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* PAYPAL BOX */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                            💳
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Gateways de Pagamento (PayPal)</h2>
                            <p className="text-sm text-slate-500">Credenciais para processamento de assinaturas e vendas de créditos.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                            <Input 
                                placeholder="Public Client ID..." 
                                value={config.paypalClientId}
                                onChange={(e) => setConfig({...config, paypalClientId: e.target.value})}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                            <Input 
                                type="password"
                                placeholder={config.paypalSecret ? '******** (Salvo)' : 'Private Secret Key...'}
                                value={config.paypalSecret === '********' ? '' : config.paypalSecret}
                                onChange={(e) => setConfig({...config, paypalSecret: e.target.value})}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook ID</label>
                            <Input 
                                placeholder="Webhook ID para assinaturas (Opcional)" 
                                value={config.paypalWebhookId}
                                onChange={(e) => setConfig({...config, paypalWebhookId: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" className="bg-slate-900 border-b-4 border-slate-950 px-8 disabled:opacity-50" disabled={saving}>
                        {saving ? 'Guardando...' : 'Salvar no Cofre'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
