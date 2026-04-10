'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    MessageSquare,
    Check,
    X,
    Eye,
    RefreshCw,
    Send,
    Settings,
    Sparkles,
    Bot,
    EyeOff
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';

interface LeadMessage {
    id: number;
    content: string;
    mediaType: string;
    fromPhone: string;
    groupJid: string;
    receivedAt: string;
    aiSuggestion: string | null;
    aiConfidence: number | null;
    aiCategory: string | null;
    status: string;
    reply: string | null;
    lead?: { id: number; phone: string; name: string | null };
}

interface Launch {
    id: number;
    name: string;
    description: string | null;
    slug: string;
    logoUrl: string | null;
    status: string;
}

interface InboxStats {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    IGNORED: number;
    TOTAL?: number;
}

interface AIConfig {
    isEnabled: boolean;
    autoReply: boolean;
    systemPrompt?: string;
}

export default function LaunchInboxPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [messages, setMessages] = useState<LeadMessage[]>([]);
    const [stats, setStats] = useState<InboxStats>({ PENDING: 0, APPROVED: 0, REJECTED: 0, IGNORED: 0 });
    const [filter, setFilter] = useState<string>('PENDING');

    // AI Config
    const [showConfig, setShowConfig] = useState(false);
    const [aiConfig, setAIConfig] = useState<AIConfig>({
        isEnabled: true,
        autoReply: false,
    });
    const [savingConfig, setSavingConfig] = useState(false);

    // Reply editing
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editedReply, setEditedReply] = useState('');


    const fetchLaunch = useCallback(async () => {
        try {
            const res = await api.get(`/launches/${id}`);
            setLaunch(res.data.launch);
        } catch (error) {
            console.error(error);
        }
    }, [id]);

    const fetchMessages = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/launches/${id}/inbox?status=${filter}`);
            setMessages(res.data.messages);
            
            // Transform Prisma groupBy array to object if needed
            if (Array.isArray(res.data.stats)) {
                const statsObj: any = { PENDING: 0, APPROVED: 0, REJECTED: 0, IGNORED: 0, TOTAL: 0 };
                res.data.stats.forEach((s: any) => {
                    if (s.status) {
                        statsObj[s.status] = s._count;
                        statsObj.TOTAL += s._count;
                    }
                });
                setStats(statsObj);
            } else {
                setStats(res.data.stats);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id, filter]);

    const fetchAIConfig = useCallback(async () => {
        try {
            const res = await api.get(`/launches/${id}/ai-config`);
            if (res.data.config) {
                setAIConfig(res.data.config);
            }
        } catch (error) {
            console.error(error);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchLaunch();
            fetchMessages();
            fetchAIConfig();
        }
    }, [id, filter, fetchLaunch, fetchMessages, fetchAIConfig]);

    const handleApprove = async (messageId: number, reply?: string) => {
        try {
            await api.post(`/launches/${id}/inbox/${messageId}/approve`, { reply });
            addToast({ type: 'success', title: 'Sucesso', message: 'Resposta enviada!' });
            setEditingId(null);
            fetchMessages();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao enviar' });
        }
    };

    const handleReject = async (messageId: number) => {
        try {
            await api.post(`/launches/${id}/inbox/${messageId}/reject`);
            addToast({ type: 'info', title: 'Info', message: 'Mensagem rejeitada' });
            fetchMessages();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao rejeitar' });
        }
    };

    const handleIgnore = async (messageId: number) => {
        try {
            await api.post(`/launches/${id}/inbox/${messageId}/ignore`);
            fetchMessages();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao ignorar' });
        }
    };

    const handleRegenerate = async (messageId: number) => {
        try {
            await api.post(`/launches/${id}/inbox/${messageId}/regenerate`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Nova sugestão gerada!' });
            fetchMessages();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao regenerar' });
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            await api.put(`/launches/${id}/ai-config`, aiConfig);
            addToast({ type: 'success', title: 'Sucesso', message: 'Configuração salva!' });
            fetchAIConfig();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar configuração' });
        } finally {
            setSavingConfig(false);
        }
    };

    // ... (helper functions stay same)

    const getCategoryBadge = (category: string | null) => {
        if (!category) return null;
        const colors: Record<string, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
            DUVIDA: 'info',
            OBJECAO: 'warning',
            INTERESSE: 'success',
            SAUDACAO: 'default',
            OUTRO: 'default',
        };
        return <Badge variant={colors[category] || 'default'}>{category}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
            PENDING: 'warning',
            APPROVED: 'info',
            SENT: 'success',
            REJECTED: 'error',
            IGNORED: 'default',
        };
        return <Badge variant={colors[status] || 'default'}>{status}</Badge>;
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

            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Inbox de Mensagens
                    </h2>
                    <p className="text-sm text-slate-500">
                        Mensagens recebidas dos leads com sugestões de IA
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setShowConfig(!showConfig)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Configurar IA
                    </Button>
                    <Button variant="ghost" onClick={fetchMessages}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* AI Config Panel */}
            {showConfig && (
                <Card className="mb-6 border-indigo-200 bg-indigo-50/50">
                    <Card.Header>
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-indigo-900">Configuração de IA deste Lançamento</h3>
                        </div>
                        <p className="text-sm text-indigo-600/80 mt-1">
                            Use as Configurações Globais (admin) para definir chaves de API.
                        </p>
                    </Card.Header>
                    <Card.Body className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Prompt do Sistema (opcional)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Instruções específicas para este lançamento. Se vazio, usa o global.
                            </p>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24"
                                value={aiConfig.systemPrompt || ''}
                                onChange={(e) => setAIConfig({ ...aiConfig, systemPrompt: e.target.value })}
                                placeholder="Ex: Você é um especialista neste lançamento. Responda dúvidas sobre o preço..."
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 pt-2">
                            <Switch
                                checked={aiConfig.isEnabled}
                                onCheckedChange={(checked) => setAIConfig({ ...aiConfig, isEnabled: checked })}
                                label="Habilitar IA neste lançamento"
                            />

                            <Switch
                                checked={aiConfig.autoReply}
                                onCheckedChange={(checked) => setAIConfig({ ...aiConfig, autoReply: checked })}
                                label="Resposta Automática (confiança ≥ 70%)"
                            />
                        </div>

                        <div className="flex justify-end border-t border-indigo-200 pt-4 mt-2">
                            <Button onClick={handleSaveConfig} loading={savingConfig}>
                                Salvar Configuração
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                {['PENDING', 'SENT', 'REJECTED', 'IGNORED'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === status
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Messages List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : messages.length === 0 ? (
                <Card className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhuma mensagem {filter.toLowerCase()}</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <Card key={msg.id} className="hover:shadow-md transition-shadow">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-900">
                                            {msg.lead?.name || msg.fromPhone}
                                        </span>
                                        {getCategoryBadge(msg.aiCategory)}
                                        {getStatusBadge(msg.status)}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {new Date(msg.receivedAt).toLocaleString()}
                                    </span>
                                </div>

                                {/* Lead Message */}
                                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                                    <p className="text-slate-800">{msg.content}</p>
                                </div>

                                {/* AI Suggestion */}
                                {msg.aiSuggestion && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-4 h-4 text-indigo-500" />
                                            <span className="text-sm font-medium text-indigo-700">
                                                Sugestão IA
                                                {msg.aiConfidence && (
                                                    <span className="ml-2 text-xs text-indigo-500">
                                                        ({Math.round(msg.aiConfidence * 100)}% confiança)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {editingId === msg.id ? (
                                            <textarea
                                                className="w-full px-3 py-2 border border-indigo-200 rounded-lg"
                                                value={editedReply}
                                                onChange={(e) => setEditedReply(e.target.value)}
                                                rows={3}
                                            />
                                        ) : (
                                            <p className="text-slate-700">{msg.aiSuggestion}</p>
                                        )}
                                    </div>
                                )}

                                {/* Reply sent */}
                                {msg.status === 'SENT' && msg.reply && (
                                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Check className="w-4 h-4 text-green-500" />
                                            <span className="text-sm font-medium text-green-700">Resposta enviada</span>
                                        </div>
                                        <p className="text-slate-700">{msg.reply}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                {msg.status === 'PENDING' && (
                                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                                        {editingId === msg.id ? (
                                            <>
                                                <Button size="sm" onClick={() => handleApprove(msg.id, editedReply)}>
                                                    <Send className="w-4 h-4 mr-1" />
                                                    Enviar
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                                    Cancelar
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                {msg.aiSuggestion && (
                                                    <Button size="sm" onClick={() => handleApprove(msg.id)}>
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Aprovar
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingId(msg.id);
                                                        setEditedReply(msg.aiSuggestion || '');
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRegenerate(msg.id)}
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-1" />
                                                    Regenerar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleReject(msg.id)}
                                                    className="text-red-500"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleIgnore(msg.id)}
                                                >
                                                    <EyeOff className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
