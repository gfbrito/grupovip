'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Globe, Key, Server, Wifi, WifiOff, CheckCircle,
    Plus, Trash2, GripVertical, AlertTriangle, RefreshCw,
    Power, PowerOff, Crown, ArrowUpRight
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

interface Settings {
    evolutionUrl: string | null;
    instanceName: string | null;
    isConfigured: boolean;
    maskedKey: string | null;
}

interface WhatsAppServer {
    id: number;
    name: string;
    type: 'BAILEYS' | 'EVOLUTION' | 'WEBJS';
    url: string;
    apiKey: string | null;
    instanceName: string | null;
    isActive: boolean;
    priority: number;
    status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    lastCheck: string | null;
    lastError: string | null;
}

interface ServersResponse {
    servers: WhatsAppServer[];
    stats: {
        total: number;
        active: number;
        hasBaileys: boolean;
        hasEvolution: boolean;
        hasWebjs: boolean;
    };
    warnings: string[];
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'servers' | 'ai' | 'legacy'>('servers');

    // Legacy settings
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; state?: string } | null>(null);
    const [evolutionUrl, setEvolutionUrl] = useState('');
    const [evolutionKey, setEvolutionKey] = useState('');
    const [instanceName, setInstanceName] = useState('');

    // New servers
    const [serversData, setServersData] = useState<ServersResponse | null>(null);
    const [loadingServers, setLoadingServers] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [testingServer, setTestingServer] = useState<number | null>(null);

    // QR Code Modal
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrData, setQrData] = useState<{ base64: string | null; message: string; connected: boolean }>({ base64: null, message: '', connected: false });
    const [activeQrServerId, setActiveQrServerId] = useState<number | null>(null);

    // AI Config Global
    const [aiConfig, setAiConfig] = useState({
        isEnabled: false,
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        systemPrompt: '',
        hasApiKey: false,
    });
    const [newAiApiKey, setNewAiApiKey] = useState('');
    const [savingAi, setSavingAi] = useState(false);

    // Add server form
    const [newServer, setNewServer] = useState({
        name: '',
        type: 'EVOLUTION' as 'BAILEYS' | 'EVOLUTION' | 'WEBJS',
        url: '',
        apiKey: '',
        instanceName: '',
    });

    const toast = useToast();
    const { user } = useAuth();

    // Plan limits
    const maxConnections = user?.plan?.maxWhatsAppServers || 1;
    const currentConnections = serversData?.stats?.total || 0;
    const canAddMore = currentConnections < maxConnections;
    const isAtLimit = currentConnections >= maxConnections;

    const fetchAIConfig = useCallback(async () => {
        try {
            const response = await api.get('/ai-config');
            if (response.data.config) {
                setAiConfig(response.data.config);
            }
        } catch (error) {
            console.error('Erro ao carregar config IA:', error);
        }
    }, []);

    const fetchSettings = useCallback(async () => {
        try {
            const response = await api.get('/settings');
            setSettings(response.data);
            if (response.data.evolutionUrl) {
                setEvolutionUrl(response.data.evolutionUrl);
            }
            if (response.data.instanceName) {
                setInstanceName(response.data.instanceName);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchServers = useCallback(async () => {
        setLoadingServers(true);
        try {
            const response = await api.get('/whatsapp-servers');
            setServersData(response.data);
        } catch (error) {
            console.error('Erro ao carregar servidores:', error);
        } finally {
            setLoadingServers(false);
        }
    }, []);

    const saveAIConfig = async () => {
        setSavingAi(true);
        try {
            const data: any = { ...aiConfig };
            if (newAiApiKey) data.apiKey = newAiApiKey;
            await api.put('/ai-config', data);
            toast.addToast({ type: 'success', title: 'Sucesso', message: 'Configuração de IA salva!' });
            setNewAiApiKey('');
            fetchAIConfig();
        } catch (error) {
            toast.addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar config IA' });
        } finally {
            setSavingAi(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchServers();
        fetchAIConfig();
    }, [fetchSettings, fetchServers, fetchAIConfig]);


    const handleTestLegacy = async () => {
        if (!evolutionUrl || !evolutionKey || !instanceName) {
            toast.error('Preencha todos os campos para testar');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const response = await api.post('/settings/test', {
                evolutionUrl,
                evolutionKey,
                instanceName,
            });
            setTestResult(response.data);
            if (response.data.success) {
                toast.success(response.data.message);
            } else {
                toast.error(response.data.message);
            }
        } catch (error: any) {
            const message = error.response?.data?.message || 'Erro ao testar conexão';
            setTestResult({ success: false, message });
            toast.error(message);
        } finally {
            setTesting(false);
        }
    };

    const handleSaveLegacy = async () => {
        if (!evolutionUrl || !evolutionKey || !instanceName) {
            toast.error('Preencha todos os campos');
            return;
        }

        if (!testResult?.success) {
            toast.warning('Teste a conexão antes de salvar');
            return;
        }

        setSaving(true);

        try {
            await api.put('/settings', {
                evolutionUrl,
                evolutionKey,
                instanceName,
            });
            toast.success('Configurações salvas com sucesso!');
            fetchSettings();
            setEvolutionKey('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleAddServer = async () => {
        const payload = { ...newServer };
        if (payload.type === 'BAILEYS' && !payload.url) {
            payload.url = window.location.origin; // Backend validates URL format, provide a default valid one
        }

        if (!payload.name || !payload.url) {
            toast.error('Nome e URL são obrigatórios');
            return;
        }

        try {
            await api.post('/whatsapp-servers', payload);
            toast.success('Servidor adicionado! Configure o pareamento.');
            setShowAddModal(false);
            setNewServer({ name: '', type: 'EVOLUTION', url: '', apiKey: '', instanceName: '' });
            fetchServers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao adicionar servidor');
        }
    };

    const handleTestServer = async (serverId: number) => {
        setTestingServer(serverId);
        try {
            const response = await api.post(`/whatsapp-servers/${serverId}/test`);
            if (response.data.success) {
                toast.success(response.data.message);
            } else {
                toast.error(response.data.message);
            }
            fetchServers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao testar servidor');
            fetchServers();
        } finally {
            setTestingServer(null);
        }
    };

    const handleOpenQr = async (serverId: number) => {
        setActiveQrServerId(serverId);
        setShowQrModal(true);
        fetchQrCode(serverId);
    };

    const fetchQrCode = useCallback(async (serverId: number) => {
        try {
            const res = await api.get(`/whatsapp-servers/${serverId}/qr`);
            setQrData({
                base64: res.data.qrCodeBase64,
                message: res.data.message,
                connected: res.data.connected
            });
            if (res.data.connected) {
                toast.success('Servidor conectado com sucesso!');
                setTimeout(() => setShowQrModal(false), 2000);
                fetchServers();
            }
        } catch(e: any) {
            console.error(e);
            toast.error('Erro ao buscar QR Code');
        }
    }, [fetchServers, toast]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showQrModal && activeQrServerId && !qrData.connected) {
            interval = setInterval(() => {
                fetchQrCode(activeQrServerId);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [showQrModal, activeQrServerId, qrData.connected, fetchQrCode]);

    const handleToggleServer = async (serverId: number, isActive: boolean) => {
        try {
            await api.post(`/whatsapp-servers/${serverId}/activate`, { isActive });
            toast.success(isActive ? 'Servidor ativado' : 'Servidor desativado');
            fetchServers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao alternar servidor');
        }
    };

    const handleDeleteServer = async (serverId: number) => {
        if (!confirm('Tem certeza que deseja remover este servidor?')) return;

        try {
            await api.delete(`/whatsapp-servers/${serverId}`);
            toast.success('Servidor removido');
            fetchServers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao remover servidor');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'CONNECTED':
                return <Badge variant="success">Conectado</Badge>;
            case 'DISCONNECTED':
                return <Badge variant="warning">Desconectado</Badge>;
            case 'ERROR':
                return <Badge variant="error">Erro</Badge>;
            default:
                return <Badge variant="default">Pendente</Badge>;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'BAILEYS':
                return <Badge variant="info">Baileys</Badge>;
            case 'EVOLUTION':
                return <Badge variant="info">Evolution</Badge>;
            case 'WEBJS':
                return <Badge variant="default">Web.js</Badge>;
            default:
                return <Badge variant="default">{type}</Badge>;
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
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
                <p className="text-slate-500 mt-1">Gerencie seus servidores WhatsApp</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('servers')}
                    className={`px-4 py-2 font-medium ${activeTab === 'servers'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Conexões WhatsApp
                </button>
                {user?.role === 'MASTER' && (
                    <>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`px-4 py-2 font-medium ${activeTab === 'ai'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            🤖 Configuração IA
                        </button>
                        <button
                            onClick={() => setActiveTab('legacy')}
                            className={`px-4 py-2 font-medium ${activeTab === 'legacy'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Configuração Legada
                        </button>
                    </>
                )}
            </div>

            {/* Servers Tab */}
            {activeTab === 'servers' && (
                <div className="space-y-4">
                    {/* Warning alerts */}
                    {serversData?.warnings && serversData.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <p className="font-medium text-amber-800">Atenção</p>
                                <ul className="text-sm text-amber-700 mt-1">
                                    {serversData.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Plan Limits Banner */}
                    <div className={`rounded-xl border p-4 ${isAtLimit ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isAtLimit ? 'bg-amber-100' : 'bg-blue-50'}`}>
                                    <Wifi className={`w-5 h-5 ${isAtLimit ? 'text-amber-600' : 'text-blue-600'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-slate-900">
                                            Conexões WhatsApp
                                        </p>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user?.plan?.name === 'FREE' ? 'bg-slate-100 text-slate-600' :
                                                user?.plan?.name === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                                                    user?.plan?.name === 'PRO' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-amber-100 text-amber-700'
                                            }`}>
                                            {user?.plan?.displayName || 'Free'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {currentConnections} de {maxConnections === 999999 ? '∞' : maxConnections} conexões utilizadas
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Progress bar */}
                                {maxConnections !== 999999 && (
                                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-amber-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min((currentConnections / maxConnections) * 100, 100)}%` }}
                                        />
                                    </div>
                                )}
                                <span className="text-lg font-bold text-slate-900">
                                    {currentConnections}/{maxConnections === 999999 ? '∞' : maxConnections}
                                </span>
                            </div>
                        </div>

                        {/* Upgrade prompt when at limit */}
                        {isAtLimit && (
                            <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-amber-800">
                                        Você atingiu o limite de conexões do seu plano
                                    </p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        Faça upgrade para adicionar mais números de WhatsApp
                                    </p>
                                </div>
                                <Link href="/admin/plans">
                                    <Button variant="primary" size="sm" className="bg-amber-500 hover:bg-amber-600">
                                        <Crown className="w-4 h-4 mr-2" />
                                        Fazer Upgrade
                                        <ArrowUpRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    {serversData && (
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg border p-4 text-center">
                                <p className="text-2xl font-bold text-slate-900">{serversData.stats.total}</p>
                                <p className="text-sm text-slate-500">Total</p>
                            </div>
                            <div className="bg-white rounded-lg border p-4 text-center">
                                <p className="text-2xl font-bold text-green-600">{serversData.stats.active}</p>
                                <p className="text-sm text-slate-500">Ativos</p>
                            </div>
                            <div className="bg-white rounded-lg border p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600">
                                    {serversData.stats.hasBaileys ? '✓' : '—'}
                                </p>
                                <p className="text-sm text-slate-500">Baileys</p>
                            </div>
                            <div className="bg-white rounded-lg border p-4 text-center">
                                <p className="text-2xl font-bold text-purple-600">
                                    {serversData.stats.hasEvolution ? '✓' : '—'}
                                </p>
                                <p className="text-sm text-slate-500">Evolution</p>
                            </div>
                        </div>
                    )}

                    {/* Add Server Button - conditional based on limit */}
                    <div className="flex justify-end">
                        {canAddMore ? (
                            <Button onClick={() => setShowAddModal(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Servidor
                            </Button>
                        ) : (
                            <Link href="/admin/plans">
                                <Button variant="secondary">
                                    <Crown className="w-4 h-4 mr-2 text-amber-500" />
                                    Upgrade para mais conexões
                                </Button>
                            </Link>
                        )}
                    </div>

                    {/* Servers List */}
                    {loadingServers ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    ) : serversData?.servers.length === 0 ? (
                        <Card>
                            <Card.Body className="text-center py-12">
                                <Server className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">Nenhum servidor configurado</p>
                                <p className="text-sm text-slate-400 mt-1">
                                    Adicione um servidor para começar
                                </p>
                            </Card.Body>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {serversData?.servers.map((server, index) => (
                                <Card key={server.id}>
                                    <Card.Body className="flex items-center gap-4">
                                        <div className="text-slate-400">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900">
                                                    {server.name}
                                                </span>
                                                {getTypeBadge(server.type)}
                                                {getStatusBadge(server.status)}
                                                {server.isActive && (
                                                    <Badge variant="success">Ativo</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {server.url}
                                                {server.instanceName && ` • ${server.instanceName}`}
                                            </p>
                                            {server.lastError && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    Erro: {server.lastError}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleTestServer(server.id)}
                                                loading={testingServer === server.id}
                                                title="Testar Conexão"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </Button>

                                            {server.type === 'BAILEYS' && server.status !== 'CONNECTED' && (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleOpenQr(server.id)}
                                                >
                                                    Parear QR
                                                </Button>
                                            )}

                                            {server.status === 'CONNECTED' && (
                                                <Button
                                                    variant={server.isActive ? 'secondary' : 'primary'}
                                                    size="sm"
                                                    onClick={() => handleToggleServer(server.id, !server.isActive)}
                                                >
                                                    {server.isActive ? (
                                                        <PowerOff className="w-4 h-4" />
                                                    ) : (
                                                        <Power className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleDeleteServer(server.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Priority Note */}
                    <p className="text-sm text-slate-500">
                        A prioridade de uso é: <strong>Baileys → Evolution → Web.js</strong>.
                        O sistema usa automaticamente o primeiro servidor ativo disponível.
                    </p>
                </div>
            )}

            {/* AI Config Tab */}
            {activeTab === 'ai' && (
                <div className="space-y-6">
                    <Card>
                        <Card.Header>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🤖</span>
                                <h3 className="font-semibold">Configuração Global de IA</h3>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Configure a IA para responder mensagens de leads automaticamente
                            </p>
                        </Card.Header>
                        <Card.Body className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Provedor</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                        value={aiConfig.provider}
                                        onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                                    >
                                        <option value="OPENAI">OpenAI</option>
                                        <option value="GEMINI">Google Gemini</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                        value={aiConfig.model}
                                        onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                                        placeholder="gpt-4o-mini"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    API Key {aiConfig.hasApiKey && <span className="text-green-600">(configurada ✓)</span>}
                                </label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    value={newAiApiKey}
                                    onChange={(e) => setNewAiApiKey(e.target.value)}
                                    placeholder={aiConfig.hasApiKey ? '***configurada***' : 'Cole sua API Key aqui'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Prompt do Sistema (opcional)
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24"
                                    value={aiConfig.systemPrompt || ''}
                                    onChange={(e) => setAiConfig({ ...aiConfig, systemPrompt: e.target.value })}
                                    placeholder="Instruções personalizadas para a IA..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="aiEnabled"
                                    checked={aiConfig.isEnabled}
                                    onChange={(e) => setAiConfig({ ...aiConfig, isEnabled: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                <label htmlFor="aiEnabled" className="text-sm font-medium">
                                    Habilitar IA globalmente
                                </label>
                            </div>

                            <div className="pt-4 border-t">
                                <Button onClick={saveAIConfig} loading={savingAi}>
                                    Salvar Configuração
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            )}

            {/* Legacy Tab */}
            {activeTab === 'legacy' && (
                <div className="space-y-6">
                    {/* Status atual */}
                    {settings?.isConfigured && (
                        <Card>
                            <Card.Body className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-green-50">
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900">API Configurada (Legado)</p>
                                    <p className="text-sm text-slate-500">
                                        {settings.evolutionUrl} • {settings.instanceName}
                                    </p>
                                </div>
                                <Badge variant="success">Conectado</Badge>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Formulário de configuração */}
                    <Card>
                        <Card.Header>
                            <h2 className="font-semibold text-slate-900">Evolution API (Configuração Legada)</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Esta é a configuração antiga. Recomendamos usar a aba &ldquo;Servidores WhatsApp&rdquo;.
                            </p>
                        </Card.Header>
                        <Card.Body className="space-y-4">
                            <Input
                                label="URL da API"
                                placeholder="https://api.evolution.com"
                                icon={<Globe className="w-5 h-5" />}
                                value={evolutionUrl}
                                onChange={(e) => {
                                    setEvolutionUrl(e.target.value);
                                    setTestResult(null);
                                }}
                            />

                            <Input
                                label="API Key"
                                type="password"
                                placeholder={settings?.maskedKey || 'Sua chave de API'}
                                icon={<Key className="w-5 h-5" />}
                                value={evolutionKey}
                                onChange={(e) => {
                                    setEvolutionKey(e.target.value);
                                    setTestResult(null);
                                }}
                            />

                            <Input
                                label="Nome da Instância"
                                placeholder="minha-instancia"
                                icon={<Server className="w-5 h-5" />}
                                value={instanceName}
                                onChange={(e) => {
                                    setInstanceName(e.target.value);
                                    setTestResult(null);
                                }}
                            />

                            {/* Resultado do teste */}
                            {testResult && (
                                <div
                                    className={`flex items-start gap-3 p-4 rounded-lg ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}
                                >
                                    {testResult.success ? (
                                        <Wifi className="w-5 h-5 text-green-500 mt-0.5" />
                                    ) : (
                                        <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
                                    )}
                                    <div>
                                        <p className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                            {testResult.success ? 'Conexão estabelecida' : 'Falha na conexão'}
                                        </p>
                                        <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                            {testResult.message}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </Card.Body>
                        <Card.Footer className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={handleTestLegacy}
                                loading={testing}
                                disabled={saving}
                            >
                                Testar Conexão
                            </Button>
                            <Button
                                onClick={handleSaveLegacy}
                                loading={saving}
                                disabled={testing || !testResult?.success}
                            >
                                Salvar Configurações
                            </Button>
                        </Card.Footer>
                    </Card>
                </div>
            )}

            {/* Add Server Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            Adicionar Servidor WhatsApp
                        </h3>

                        <div className="space-y-4">
                            <Input
                                label="Nome da Conexão"
                                placeholder="Ex: Meu Celular"
                                value={newServer.name}
                                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                            />

                            {user?.role === 'MASTER' ? (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Tipo
                                    </label>
                                    <select
                                        value={newServer.type}
                                        onChange={(e) => setNewServer({
                                            ...newServer,
                                            type: e.target.value as 'BAILEYS' | 'EVOLUTION' | 'WEBJS'
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="BAILEYS">Baileys</option>
                                        <option value="EVOLUTION">Evolution API</option>
                                        <option value="WEBJS">WhatsApp Web.js</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                                    <p className="text-xs text-blue-700 font-medium">Infraestrutura Configurada</p>
                                    <p className="text-[10px] text-blue-600">Este servidor utilizará a infraestrutura otimizada do sistema.</p>
                                </div>
                            )}

                            {(user?.role === 'MASTER' || newServer.type !== 'BAILEYS') && user?.role === 'MASTER' && (
                                <Input
                                    label="URL do Servidor"
                                    placeholder="https://..."
                                    value={newServer.url}
                                    onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                                />
                            )}

                            {newServer.type === 'EVOLUTION' && (
                                <>
                                    {user?.role === 'MASTER' && (
                                        <Input
                                            label="API Key"
                                            type="password"
                                            placeholder="Sua API Key"
                                            value={newServer.apiKey}
                                            onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })}
                                        />
                                    )}
                                    <Input
                                        label="Nome da Instância"
                                        placeholder="Ex: dunder-mifflin"
                                        value={newServer.instanceName}
                                        onChange={(e) => setNewServer({ ...newServer, instanceName: e.target.value })}
                                    />
                                    {user?.role !== 'MASTER' && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Escolha um nome único para sua instância no servidor.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleAddServer}>
                                Adicionar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQrModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Escaneie o QR Code</h3>
                        <p className="text-sm text-slate-500 mb-6">{qrData.message || 'Aguardando...'}</p>
                        
                        <div className="flex justify-center mb-6 min-h-[250px] items-center">
                            {qrData.connected ? (
                                <CheckCircle className="w-20 h-20 text-green-500" />
                            ) : qrData.base64 ? (
                                <Image src={qrData.base64} alt="QR Code" width={256} height={256} className="border rounded p-2" />
                            ) : (
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                            )}
                        </div>

                        <Button variant="secondary" onClick={() => setShowQrModal(false)} className="w-full">
                            {qrData.connected ? 'Fechar' : 'Cancelar Pareamento'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
