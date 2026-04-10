'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Search,
    Download,
    Filter,
    MoreVertical,
    ShieldBan,
    LogOut,
    UserX,
    RefreshCw,
    MessageCircle,
    Send,
    Flame,
    ArrowUpDown,
    X
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

export default function LaunchLeadsPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<any>(null);
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Filtros
    const [search, setSearch] = useState('');

    const [statusFilter, setStatusFilter] = useState('all');
    const [classificationFilter, setClassificationFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('last_seen');

    const [openActionId, setOpenActionId] = useState<number | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number, left: number } | null>(null);

    // Modal de envio de mensagem privada
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [privateMessage, setPrivateMessage] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    // Fechar dropdown ao clicar fora ou scrollar
    useEffect(() => {
        const handleClose = () => {
            setOpenActionId(null);
            setDropdownPos(null);
        };
        document.addEventListener('click', handleClose);
        window.addEventListener('scroll', handleClose, true); // true para capturar scroll em elementos filhos
        return () => {
            document.removeEventListener('click', handleClose);
            window.removeEventListener('scroll', handleClose, true);
        };
    }, []);

    useEffect(() => {
        if (id) {
            fetchData();
        }

    }, [id, statusFilter, classificationFilter, sortOrder]); // Recarregar quando filtro mudar

    const fetchData = async () => {
        try {
            setLoading(true);

            const queryParams = new URLSearchParams();
            if (search) queryParams.append('search', search);

            if (statusFilter !== 'all') queryParams.append('status', statusFilter);
            if (classificationFilter !== 'all') queryParams.append('classification', classificationFilter);
            if (sortOrder !== 'last_seen') queryParams.append('sort', sortOrder);

            const [launchRes, leadsRes, statsRes] = await Promise.all([
                api.get(`/launches/${id}`),
                api.get(`/launches/${id}/leads?${queryParams.toString()}`),
                api.get(`/launches/${id}/leads/stats`),
            ]);

            setLaunch(launchRes.data.launch);
            setLeads(leadsRes.data.leads);
            setStats(statsRes.data.stats);

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Falha ao carregar leads.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
    };

    const handleExport = async () => {
        try {
            // Trigger download
            window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/launches/${id}/leads/export`, '_blank');
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Erro ao exportar leads.',
            });
        }
    };

    const handleBlockLead = async (leadId: number) => {
        if (!confirm('Tem certeza que deseja bloquear este lead? Ele será removido de todos os grupos e impedido de entrar novamente.')) return;

        try {
            await api.post(`/launches/${id}/leads/${leadId}/block`);

            addToast({
                type: 'success',
                title: 'Sucesso',
                message: 'Lead bloqueado com sucesso.',
            });

            // Atualizar lista localmente para refletir bloqueio imediato
            setLeads(leads.map(l => l.id === leadId ? { ...l, isBlocked: true, status: 'BLOCKED' } : l));

            // Recarregar stats também é bom
            // fetchData(); // Opcional, se quiser reload completo
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao bloquear lead.',
            });
        }
    };

    const handleUnblockLead = async (leadId: number) => {
        try {
            await api.patch(`/launches/${id}/leads/${leadId}`, { isBlocked: false });
            addToast({ type: 'success', title: 'Sucesso', message: 'Lead desbloqueado.' });
            setLeads(leads.map(l => l.id === leadId ? { ...l, isBlocked: false, status: 'ACTIVE' } : l));
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao desbloquear lead.' });
        }
    };

    const handleRemoveLead = async (leadId: number) => {
        if (!confirm('Remover este lead de TODOS os grupos? (Ele poderá entrar novamente se usar o link)')) return;

        try {
            await api.delete(`/launches/${id}/leads/${leadId}/groups`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Lead removido dos grupos.' });
            // Atualizar UI - remove grupos da lista do lead
            setLeads(leads.map(l => l.id === leadId ? { ...l, groups: [] } : l));
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao remover lead.' });
        }
    };

    const handleSendPrivateMessage = async () => {
        if (!privateMessage.trim()) {
            addToast({ type: 'warning', title: 'Atenção', message: 'Digite uma mensagem para enviar.' });
            return;
        }

        const activeLeadsCount = stats?.active || 0;
        if (activeLeadsCount === 0) {
            addToast({ type: 'warning', title: 'Atenção', message: 'Nenhum lead ativo para enviar mensagem.' });
            return;
        }

        if (!confirm(`Enviar mensagem privada para ${activeLeadsCount} leads ativos? Esta operação pode demorar alguns minutos.`)) {
            return;
        }

        try {
            setIsSendingMessage(true);
            const response = await api.post(`/launches/${id}/leads/send-private`, {
                message: privateMessage.trim()
            });

            const result = response.data;
            addToast({
                type: result.stats.failed > 0 ? 'warning' : 'success',
                title: 'Envio Concluído',
                message: `${result.stats.success} mensagens enviadas, ${result.stats.failed} falhas.`
            });

            setIsMessageModalOpen(false);
            setPrivateMessage('');
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao enviar mensagens privadas.'
            });
        } finally {
            setIsSendingMessage(false);
        }
    };

    const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
        ACTIVE: 'success',
        INACTIVE: 'warning',
        BLOCKED: 'error',
    };

    const statusLabels: Record<string, string> = {
        ACTIVE: 'Ativo',
        INACTIVE: 'Inativo',
        BLOCKED: 'Bloqueado',
    };

    const classificationColors: Record<string, string> = {
        HOT: 'bg-red-50 text-red-700 border-red-200',
        WARM: 'bg-orange-50 text-orange-700 border-orange-200',
        COOL: 'bg-blue-50 text-blue-700 border-blue-200',
        COLD: 'bg-slate-50 text-slate-500 border-slate-200',
    };

    const classificationLabels: Record<string, string> = {
        HOT: '🔥 Hot',
        WARM: '🟠 Warm',
        COOL: '🔵 Cool',
        COLD: '⚪ Cold',
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

            {/* Stats Resumidos */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium mt-1">Total de Leads</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center text-center bg-green-50 border-green-200">
                        <span className="text-2xl font-bold text-green-700">{stats.active}</span>
                        <span className="text-xs text-green-600 uppercase font-medium mt-1">Ativos</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center text-center bg-yellow-50 border-yellow-200">
                        <span className="text-2xl font-bold text-yellow-700">{stats.inactive}</span>
                        <span className="text-xs text-yellow-600 uppercase font-medium mt-1">Inativos</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center text-center bg-red-50 border-red-200">
                        <span className="text-2xl font-bold text-red-700">{stats.blocked}</span>
                        <span className="text-xs text-red-600 uppercase font-medium mt-1">Bloqueados</span>
                    </Card>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-6">
                <div className="flex-1 w-full md:max-w-md">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por telefone..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button type="submit" variant="secondary">Buscar</Button>
                    </form>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="ghost" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>

                    <Button variant="secondary" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar CSV
                    </Button>

                    <Button
                        onClick={() => setIsMessageModalOpen(true)}
                        disabled={!stats?.active}
                        title={stats?.active ? `Enviar para ${stats.active} leads ativos` : 'Nenhum lead ativo'}
                    >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Enviar Mensagem
                    </Button>

                    <select
                        className="h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                        <option value="blocked">Bloqueados</option>
                    </select>


                    <select
                        className="h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={classificationFilter}
                        onChange={(e) => setClassificationFilter(e.target.value)}
                    >
                        <option value="all">Todas Classificações</option>
                        <option value="HOT">🔥 Leads Quentes</option>
                        <option value="WARM">🟠 Leads Mornos</option>
                        <option value="COOL">🔵 Leads Frios</option>
                        <option value="COLD">⚪ Leads Gelados</option>
                    </select>

                    <select
                        className="h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="last_seen">Recentes</option>
                        <option value="score_desc">Maior Score</option>
                        <option value="score_asc">Menor Score</option>
                        <option value="oldest">Antigos</option>
                    </select>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Lead / Grupos</th>

                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Entrada</th>
                                <th className="px-4 py-3">Saída</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {leads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        Nenhum lead encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium text-slate-900">{lead.phone}</span>
                                                {lead.name && (
                                                    <span className="text-xs text-slate-500 font-normal">{lead.name}</span>
                                                )}
                                                <div className="flex flex-wrap gap-1">
                                                    {lead.groups.length > 0 ? (
                                                        lead.groups.map((g: any) => (
                                                            <span
                                                                key={g.groupId}
                                                                className={`text-[10px] px-1.5 py-0.5 rounded border ${g.isActive
                                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                                                    }`}
                                                            >
                                                                Grupo {g.group.number}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Sem grupo</span>
                                                    )}
                                                </div>
                                            </div>

                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classificationColors[lead.classification] || classificationColors['COLD']}`}>
                                                    {classificationLabels[lead.classification] || 'Cold'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium ml-1">
                                                    {lead.score || 0} pts
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={statusColors[lead.status as keyof typeof statusColors] || 'default'}>
                                                {statusLabels[lead.status as keyof typeof statusLabels] || lead.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {lead.groups[0]?.joinedAt ? new Date(lead.groups[0].joinedAt).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {lead.groups[0]?.leftAt ? new Date(lead.groups[0].leftAt).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-slate-500 hover:text-slate-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (openActionId === lead.id) {
                                                            setOpenActionId(null);
                                                            setDropdownPos(null);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setOpenActionId(lead.id);
                                                            // Posicionar fixed na tela
                                                            setDropdownPos({
                                                                top: rect.bottom,
                                                                left: rect.right - 192 // w-48 = 192px
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {openActionId && dropdownPos && (
                <div
                    className="fixed w-48 bg-white rounded-md shadow-lg border border-slate-100 z-[9999] py-1 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: dropdownPos.top,
                        left: dropdownPos.left
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-slate-50 mb-1">
                        Ações do Lead
                    </div>

                    <button
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => {
                            handleRemoveLead(openActionId);
                            setOpenActionId(null);
                        }}
                    >
                        <LogOut className="w-4 h-4 text-slate-400" />
                        Remover dos Grupos
                    </button>

                    {leads.find(l => l.id === openActionId)?.isBlocked ? (
                        <button
                            className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                            onClick={() => {
                                handleUnblockLead(openActionId);
                                setOpenActionId(null);
                            }}
                        >
                            <ShieldBan className="w-4 h-4" />
                            Desbloquear
                        </button>
                    ) : (
                        <button
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => {
                                handleBlockLead(openActionId);
                                setOpenActionId(null);
                            }}
                        >
                            <ShieldBan className="w-4 h-4" />
                            Bloquear Acesso
                        </button>
                    )}
                </div>
            )
            }


            {/* Modal de Envio de Mensagem Privada */}
            {
                isMessageModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-lg">Enviar Mensagem Privada</h3>
                                <button
                                    onClick={() => {
                                        setIsMessageModalOpen(false);
                                        setPrivateMessage('');
                                    }}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4">
                                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                    <p className="text-sm text-indigo-800">
                                        <strong>{stats?.active || 0} leads ativos</strong> receberão esta mensagem no privado.
                                    </p>
                                    <p className="text-xs text-indigo-600 mt-1">
                                        As mensagens serão enviadas com intervalo para evitar bloqueios.
                                    </p>
                                </div>

                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Mensagem
                                </label>
                                <textarea
                                    value={privateMessage}
                                    onChange={(e) => setPrivateMessage(e.target.value)}
                                    placeholder="Digite a mensagem que será enviada para todos os leads..."
                                    className="w-full h-32 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    disabled={isSendingMessage}
                                />
                                <div className="text-right text-xs text-slate-400 mt-1">
                                    {privateMessage.length} caracteres
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setIsMessageModalOpen(false);
                                        setPrivateMessage('');
                                    }}
                                    disabled={isSendingMessage}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSendPrivateMessage}
                                    disabled={isSendingMessage || !privateMessage.trim()}
                                >
                                    {isSendingMessage ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Enviar Mensagem
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
