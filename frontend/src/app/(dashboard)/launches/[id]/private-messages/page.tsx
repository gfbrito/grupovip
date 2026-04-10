'use client';

import { useState, useEffect, Fragment } from 'react';
import { useParams } from 'next/navigation';
import {
    Plus,
    Send,
    Image as ImageIcon,
    FileText,
    Video,
    Mic,
    Clock,
    Trash2,
    Play,
    CheckCircle,
    AlertCircle,
    XCircle,
    ChevronDown,
    ChevronRight,
    Users,
    Check,
    X,
    RefreshCw
} from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import WhatsAppText from '@/components/ui/WhatsAppText';

interface Launch {
    id: number;
    name: string;
    description: string | null;
    slug: string;
    logoUrl: string | null;
    status: string;
}

interface PrivateMessage {
    id: number;
    title: string;
    content: string;
    type: string;
    mediaUrl: string | null;
    scheduledAt: string;
    delayMin: number;
    delayMax: number;
    status: string;
    logs: Array<{
        id: number;
        leadPhone: string;
        status: string;
        sentAt: string | null;
        error: string | null;
    }>;
}

interface PrivateMessageStats {
    totalMessages: number;
    totalSent: number;
    totalFailed: number;
    pendingCount: number;
}

export default function PrivateMessagesPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [messages, setMessages] = useState<PrivateMessage[]>([]);
    const [stats, setStats] = useState<PrivateMessageStats | null>(null);

    // Create Form State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        type: 'TEXT',
        title: '',
        content: '',
        mediaUrl: '',
        scheduledAt: '',
        delayMin: 1.5,
        delayMax: 3, // Segundos
    });

    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

    const toggleMessageExpand = (msgId: number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(msgId)) {
                newSet.delete(msgId);
            } else {
                newSet.add(msgId);
            }
            return newSet;
        });
    };

    // Logs Modal State
    const [logsModalOpen, setLogsModalOpen] = useState(false);
    const [logsMessageId, setLogsMessageId] = useState<number | null>(null);
    const [messageLogs, setMessageLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const openLogsModal = async (msgId: number) => {
        setLogsMessageId(msgId);
        setLogsModalOpen(true);
        setLogsLoading(true);
        try {
            const res = await api.get(`/launches/${id}/private-messages/${msgId}/logs`);
            setMessageLogs(res.data.logs || []);
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao carregar logs.' });
            setMessageLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [launchRes, msgsRes, statsRes] = await Promise.all([
                api.get(`/launches/${id}`),
                api.get(`/launches/${id}/private-messages`),
                api.get(`/launches/${id}/leads/stats`),
            ]);

            setLaunch(launchRes.data.launch);
            setMessages(msgsRes.data.messages);
            setStats(statsRes.data.stats);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Falha ao carregar mensagens.',
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

    const handleCreate = async (e: React.FormEvent, sendNow: boolean = false) => {
        e.preventDefault();
        try {
            if (!formData.content) {
                addToast({ type: 'warning', title: 'Atenção', message: 'Conteúdo da mensagem é obrigatório.' });
                return;
            }
            if (formData.type !== 'TEXT' && !formData.mediaUrl) {
                addToast({ type: 'warning', title: 'Atenção', message: 'URL da mídia é obrigatória.' });
                return;
            }

            if (!sendNow) {
                if (!formData.scheduledAt) {
                    addToast({ type: 'warning', title: 'Atenção', message: 'Selecione uma data para agendar ou use "Enviar Agora".' });
                    return;
                }
                if (new Date(formData.scheduledAt) <= new Date()) {
                    addToast({ type: 'warning', title: 'Atenção', message: 'A data deve ser futura.' });
                    return;
                }
            }

            if (sendNow && !confirm(`Enviar esta mensagem imediatamente para ${stats?.active || 0} leads ativos?`)) {
                return;
            }

            await api.post(`/launches/${id}/private-messages`, {
                ...formData,
                delayMin: formData.delayMin * 1000,
                delayMax: formData.delayMax * 1000,
                sendNow,
            });

            addToast({
                type: 'success',
                title: 'Sucesso',
                message: sendNow ? 'Envio iniciado!' : 'Mensagem agendada.'
            });
            setShowForm(false);
            setFormData({
                type: 'TEXT',
                title: '',
                content: '',
                mediaUrl: '',
                scheduledAt: '',
                delayMin: 1.5,
                delayMax: 3,
            });
            fetchData();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao criar mensagem.' });
        }
    };

    const handleDelete = async (messageId: number) => {
        if (!confirm('Excluir esta mensagem?')) return;
        try {
            await api.delete(`/launches/${id}/private-messages/${messageId}`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Mensagem excluída.' });
            fetchData();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao excluir mensagem.' });
        }
    };

    const handleSendNow = async (messageId: number) => {
        if (!confirm('Enviar esta mensagem imediatamente?')) return;
        try {
            await api.post(`/launches/${id}/private-messages/${messageId}/send`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Envio iniciado!' });
            fetchData();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao iniciar envio.' });
        }
    };

    const statusColors = {
        DRAFT: 'default',
        SCHEDULED: 'warning',
        SENDING: 'info',
        COMPLETED: 'success',
        FAILED: 'error',
    } as const;

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
                    <h2 className="text-xl font-bold text-slate-900">Mensagens Privadas</h2>
                    <p className="text-sm text-slate-500">
                        Envie mensagens diretamente no privado para os leads ativos.
                        {stats && <span className="ml-1 font-medium text-indigo-600">({stats.active} leads ativos)</span>}
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Mensagem
                </Button>
            </div>

            {showForm && (
                <Card className="mb-8 border-indigo-100 shadow-md">
                    <Card.Header className="bg-indigo-50/50">
                        <h3 className="font-semibold text-indigo-900">Nova Mensagem Privada</h3>
                    </Card.Header>
                    <Card.Body>
                        <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm text-amber-800">
                                        <strong>Atenção:</strong> Esta mensagem será enviada para <strong>{stats?.active || 0} leads ativos</strong> diretamente no privado.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                        <select
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="TEXT">Texto</option>
                                            <option value="IMAGE">Imagem</option>
                                            <option value="VIDEO">Vídeo</option>
                                            <option value="AUDIO">Áudio</option>
                                            <option value="DOCUMENT">Documento</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora (opcional)</label>
                                        <Input
                                            type="datetime-local"
                                            value={formData.scheduledAt}
                                            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Título (Interno)</label>
                                    <Input
                                        placeholder="Ex: Mensagem de Boas Vindas"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                {formData.type !== 'TEXT' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">URL da Mídia</label>
                                        <Input
                                            placeholder={`URL do ${formData.type.toLowerCase()}...`}
                                            value={formData.mediaUrl}
                                            onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo / Legenda</label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 h-40 font-mono text-sm"
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="Digite sua mensagem aqui... Use *bold*, _italic_, ~strike~"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Delay Mín (seg)</label>
                                        <Input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={formData.delayMin}
                                            onChange={(e) => setFormData({ ...formData, delayMin: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Delay Máx (seg)</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="0.5"
                                            value={formData.delayMax}
                                            onChange={(e) => setFormData({ ...formData, delayMax: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={loading}
                                        className="flex-1"
                                        onClick={(e) => handleCreate(e, true)}
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        Enviar Agora
                                    </Button>
                                    <Button type="submit" disabled={loading} className="flex-1">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Agendar
                                    </Button>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
                                <h4 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">Preview WhatsApp</h4>
                                <div className="bg-[#e5ddd5] p-4 rounded-lg min-h-[400px] flex flex-col relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-10 bg-repeat space-y-2 pointer-events-none" style={{ backgroundImage: 'url(/whatsapp-bg.png)' }}></div>

                                    <div className="flex-1"></div>

                                    <div className="bg-white rounded-lg p-1 shadow-sm max-w-[90%] self-start rounded-tl-none relative z-10">
                                        <div className="p-1">
                                            {formData.type !== 'TEXT' && formData.mediaUrl && (
                                                <div className="bg-slate-100 rounded mb-1 h-32 flex items-center justify-center text-slate-400 overflow-hidden">
                                                    {formData.type === 'IMAGE' ? (
                                                        <Image src={formData.mediaUrl} alt="Preview" fill className="object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center">
                                                            {formData.type === 'VIDEO' && <Video className="w-8 h-8" />}
                                                            {formData.type === 'AUDIO' && <Mic className="w-8 h-8" />}
                                                            {formData.type === 'DOCUMENT' && <FileText className="w-8 h-8" />}
                                                            <span className="text-xs mt-1">{formData.type}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="px-2 pb-1">
                                                <WhatsAppText text={formData.content || 'Sua mensagem aparecerá aqui...'} className="text-sm text-slate-900" />
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 text-right px-2 pb-1 flex items-center justify-end gap-1">
                                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Card.Body>
                </Card>
            )}

            {/* Lista de Mensagens */}
            <div className="space-y-4">
                {messages.length === 0 ? (
                    <Card className="p-8 text-center text-slate-500">
                        <Send className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p>Nenhuma mensagem privada agendada.</p>
                    </Card>
                ) : (
                    messages.map((msg) => (
                        <Card key={msg.id} className="hover:border-indigo-200 transition-colors">
                            <div className="flex flex-col md:flex-row shadow-sm">
                                <div className="bg-slate-50 p-4 w-full md:w-64 border-r border-slate-100 flex-shrink-0 flex items-center justify-center">
                                    {msg.type === 'TEXT' ? (
                                        <FileText className="w-8 h-8 text-slate-300" />
                                    ) : msg.mediaUrl ? (
                                        <div className="relative w-full h-24 bg-slate-200 rounded overflow-hidden">
                                            {msg.type === 'IMAGE' ? (
                                                <Image src={msg.mediaUrl} fill className="object-cover" alt="Media" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                                    {msg.type === 'VIDEO' ? <Video /> : <Mic />}
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <button
                                                        onClick={() => toggleMessageExpand(msg.id)}
                                                        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 -ml-1"
                                                        title={expandedMessages.has(msg.id) ? 'Recolher' : 'Expandir'}
                                                    >
                                                        {expandedMessages.has(msg.id) ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 w-full text-base">
                                                        {msg.title || new Date(msg.scheduledAt || msg.createdAt || Date.now()).toLocaleString()}
                                                        <div className="flex-1 h-px bg-slate-200 mx-2 border-t border-dashed border-slate-300"></div>
                                                        <div className="flex gap-1 text-slate-400">
                                                            {msg.type === 'IMAGE' && <ImageIcon className="w-4 h-4" />}
                                                            {msg.type === 'VIDEO' && <Video className="w-4 h-4" />}
                                                            {msg.type === 'AUDIO' && <Mic className="w-4 h-4" />}
                                                            {msg.type === 'DOCUMENT' && <FileText className="w-4 h-4" />}
                                                            {msg.type === 'TEXT' && <FileText className="w-4 h-4" />}
                                                        </div>
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={statusColors[msg.status as keyof typeof statusColors]}>
                                                        {msg.status}
                                                    </Badge>
                                                    <span className="text-xs text-slate-500 flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {msg.scheduledAt ? new Date(msg.scheduledAt).toLocaleString() : 'Rascunho'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 ml-4 self-start">
                                                {(msg.status === 'SCHEDULED' || msg.status === 'DRAFT') && (
                                                    <Button variant="ghost" size="sm" title="Enviar Agora" onClick={() => handleSendNow(msg.id)}>
                                                        <Play className="w-4 h-4 text-green-600" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" title="Excluir" onClick={() => handleDelete(msg.id)} className="text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {expandedMessages.has(msg.id) && (
                                            <div className="text-sm text-slate-800 line-clamp-3 mb-2 font-mono bg-slate-50 p-2 rounded mt-2">
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                                        <span>Tipo: {msg.type}</span>
                                        <span>Delay: {msg.delayMin / 1000}s - {msg.delayMax / 1000}s</span>
                                        <span className="flex items-center gap-1">
                                            {msg.successCount > 0 || msg.failedCount > 0 ? (
                                                <>
                                                    <span className="text-green-600">{msg.successCount} ✓</span>
                                                    <span className="text-red-600">{msg.failedCount} ✗</span>
                                                </>
                                            ) : (
                                                `${stats?.active || 0} leads`
                                            )}
                                            <button
                                                onClick={() => openLogsModal(msg.id)}
                                                className="text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                                                title="Ver status de envio"
                                            >
                                                <Users className="w-4 h-4" />
                                            </button>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal de Status de Envio */}
            {logsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">Status de Envio por Lead</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {messageLogs.length} lead{messageLogs.length !== 1 ? 's' : ''} processado{messageLogs.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {logsLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : messageLogs.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">Nenhum envio registrado</p>
                                    <p className="text-sm mt-1">Os logs aparecerão aqui após o envio.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {messageLogs.map((log, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 px-6 py-3 ${log.status === 'SENT'
                                                ? 'bg-white hover:bg-green-50/50'
                                                : 'bg-red-50/30 hover:bg-red-50/50'
                                                } transition-colors`}
                                        >
                                            <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${log.status === 'SENT'
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-red-100 text-red-600'
                                                }`}>
                                                {log.status === 'SENT' ? (
                                                    <Check className="w-3.5 h-3.5" />
                                                ) : (
                                                    <X className="w-3.5 h-3.5" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800 truncate" title={log.phone}>
                                                    {log.leadName || log.phone}
                                                </p>
                                                <p className="text-xs text-slate-500">{log.phone}</p>
                                                {log.error && (
                                                    <p className="text-xs text-red-600 mt-0.5 line-clamp-2">{log.error}</p>
                                                )}
                                            </div>

                                            <div className="flex-shrink-0 text-right">
                                                <p className="text-xs text-slate-400 whitespace-nowrap">
                                                    {new Date(log.sentAt).toLocaleDateString('pt-BR')}
                                                </p>
                                                <p className="text-xs text-slate-400 whitespace-nowrap">
                                                    {new Date(log.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        {messageLogs.filter(l => l.status === 'SENT').length} enviado{messageLogs.filter(l => l.status === 'SENT').length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        {messageLogs.filter(l => l.status === 'FAILED').length} falha{messageLogs.filter(l => l.status === 'FAILED').length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setLogsModalOpen(false)}>Fechar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
