'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams } from 'next/navigation';
import {
    Plus,
    RefreshCw,
    Link as LinkIcon,
    MoreVertical,
    Trash2,
    Edit,
    ExternalLink,
    Users,
    ChevronDown,
    ChevronUp,
    Copy,
    Check
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LaunchHeader from '@/components/launch/LaunchHeader';
import LaunchTabs from '@/components/launch/LaunchTabs';
import GroupCreationProgress from '@/components/launch/GroupCreationProgress';
import GroupParticipantsList from '@/components/launch/GroupParticipantsList';
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

interface Group {
    id: number;
    groupId: string;
    number: number;
    name: string;
    nickname: string | null;
    inviteUrl: string | null;
    participantsCount: number;
    maxParticipants: number;
    isActive: boolean;
    isFull: boolean;
    isLocked: boolean;
    lastSync: string | null;
}

interface QueueItem {
    id: string;
    launchId: number;
    amount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress: number;
    message: string;
    createdAt: string;
}

export default function LaunchGroupsPage() {
    const params = useParams();
    const id = params?.id as string;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);

    // Estado para expansão de linha
    const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
    const [expandedTimestamp, setExpandedTimestamp] = useState<number>(0);

    const toggleGroupExpansion = (groupId: number) => {
        setExpandedGroupId(curr => {
            if (curr === groupId) return null;
            setExpandedTimestamp(Date.now());
            return groupId;
        });
    };


    // Estados para modais/ações
    const [isCreating, setIsCreating] = useState(false);
    const [createAmount, setCreateAmount] = useState(1);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
    const [copiedGroupId, setCopiedGroupId] = useState<number | null>(null);


    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [launchRes, groupsRes, queueRes] = await Promise.all([
                api.get(`/launches/${id}`),
                api.get(`/launches/${id}/groups`),
                api.get(`/launches/${id}/groups/queue`),
            ]);

            setLaunch(launchRes.data.launch);
            setGroups(groupsRes.data.groups);
            setQueue(queueRes.data.queue);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Falha ao carregar grupos.',
            });
        } finally {
            setLoading(false);
        }
    }, [id, addToast]);

    const fetchQueue = useCallback(async () => {
        try {
            const response = await api.get(`/launches/${id}/groups/queue`);
            setQueue(response.data.queue);
            // Se fila finalizou e novos grupos foram criados, recarregar lista
            if (response.data.queue.length === 0 && queue.length > 0) {
                const groupsRes = await api.get(`/launches/${id}/groups`);
                setGroups(groupsRes.data.groups);
            }
        } catch (error) {
            console.error('Erro ao atualizar fila:', error);
        }
    }, [id, queue.length]);


    const handleCreateGroups = async () => {
        if (createAmount < 1) return;

        try {
            setIsCreating(true);
            await api.post(`/launches/${id}/groups`, {
                quantity: createAmount,
            });

            addToast({
                type: 'success',
                title: 'Sucesso',
                message: `${createAmount} grupos agendados para criação.`,
            });

            fetchQueue();
            setCreateAmount(1);
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao agendar criação.',
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleStatus = async (groupId: number, currentStatus: boolean) => {
        try {
            // Atualização otimista
            setGroups(groups.map(g => {
                if (g.id === groupId) return { ...g, isReceiving: !currentStatus };
                return g;
            }));

            await api.patch(`/launches/${id}/groups/${groupId}`, {
                isReceiving: !currentStatus
            });

            addToast({
                type: 'success',
                title: 'Sucesso',
                message: `Grupo ${!currentStatus ? 'ativado' : 'pausado'} para recebimento.`,
            });
        } catch (error) {
            // Reverter em caso de erro
            setGroups(groups.map(g => {
                if (g.id === groupId) return { ...g, isReceiving: currentStatus };
                return g;
            }));
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Erro ao atualizar status do grupo.',
            });
        }
    };



    // ==================== VINCULAÇÃO DE GRUPOS ====================
    const [isLinking, setIsLinking] = useState(false);
    const [availableGroups, setAvailableGroups] = useState<any[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [globalLoading, setGlobalLoading] = useState(false);
    const [globalSyncing, setGlobalSyncing] = useState(false);
    const [isLinkingSubmitting, setIsLinkingSubmitting] = useState(false);

    // Carregar grupos disponíveis quando abrir modal

    const fetchAvailableGroups = useCallback(async () => {
        try {
            setGlobalLoading(true);
            const res = await api.get('/groups');
            setAvailableGroups(res.data.groups || []);
        } catch (error) {
            console.error('Erro ao buscar grupos globais:', error);
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao carregar lista de grupos.' });
        } finally {
            setGlobalLoading(false);
        }
    }, [addToast]);

    const handleGlobalSync = async () => {
        try {
            setGlobalSyncing(true);
            await api.post('/groups/sync'); // Sync global da Evolution
            addToast({ type: 'success', title: 'Sucesso', message: 'Lista de grupos atualizada do WhatsApp.' });
            await fetchAvailableGroups();
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao sincronizar com WhatsApp.' });
        } finally {
            setGlobalSyncing(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            setSyncProgress(0);
            setSyncMessage('Iniciando sincronização...');

            // Simulação de progresso enquanto aguarda resposta
            const totalGroups = groups.length || 1;
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                setSyncProgress(Math.round(progress));
                setSyncMessage(`Sincronizando grupos... ${Math.round(progress)}%`);
            }, 500);

            const res = await api.post(`/launches/${id}/groups/sync`);

            clearInterval(progressInterval);
            setSyncProgress(100);
            setSyncMessage('Concluído!');

            // Mensagem detalhada com estatísticas
            const msg = res.data.details
                ? `${res.data.message}\n${res.data.details}`
                : res.data.message;

            addToast({
                type: 'success',
                title: 'Sincronização Concluída',
                message: msg
            });
            fetchData();
            setLastSyncTime(Date.now());

            // Pequeno delay para mostrar 100%
            setTimeout(() => {
                setSyncProgress(0);
                setSyncMessage('');
            }, 1000);
        } catch (error) {
            console.error(error);
            setSyncProgress(0);
            setSyncMessage('');
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao sincronizar membros.' });
        } finally {
            setSyncing(false);
        }
    };

    const handleLinkSubmit = async () => {
        if (selectedGroupIds.length === 0) return;

        try {
            setIsLinkingSubmitting(true);
            const res = await api.post(`/launches/${id}/groups/link`, {
                groupIds: selectedGroupIds
            });

            addToast({
                type: 'success',
                title: 'Grupos Vinculados',
                message: `${res.data.message}`
            });

            setIsLinking(false);
            fetchData(); // Recarregar lista do lançamento
        } catch (error: any) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao vincular grupos.'
            });
        } finally {
            setIsLinkingSubmitting(false);
        }
    };

    const handleDeleteGroup = async (groupId: number, groupName: string) => {
        if (!confirm(`Tem certeza que deseja remover o grupo "${groupName}" deste lançamento? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            await api.delete(`/launches/${id}/groups/${groupId}`);

            // Atualizar a lista localmente
            setGroups(groups.filter(g => g.id !== groupId));

            // Fechar a expansão se o grupo excluído estava expandido
            if (expandedGroupId === groupId) {
                setExpandedGroupId(null);
            }

            addToast({
                type: 'success',
                title: 'Grupo Removido',
                message: `O grupo "${groupName}" foi removido do lançamento.`
            });
        } catch (error: any) {
            console.error('Erro ao excluir grupo:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao remover grupo do lançamento.'
            });
        }
    };

    useEffect(() => {
        if (id) {
            fetchData();
            // Polling para fila se houver itens pendentes
            const interval = setInterval(() => {
                fetchQueue();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [id, fetchData, fetchQueue]);

    useEffect(() => {
        if (isLinking) {
            fetchAvailableGroups();
            setSelectedGroupIds([]);
        }
    }, [isLinking, fetchAvailableGroups]);

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
                    <h2 className="text-xl font-bold text-slate-900">Grupos do WhatsApp</h2>
                    <p className="text-sm text-slate-500">
                        Gerencie os grupos de captação deste lançamento.
                    </p>
                </div>

                <div className="flex gap-2 items-center">
                    {syncing ? (
                        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-indigo-700">{syncMessage}</span>
                                <div className="w-40 h-2 bg-indigo-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                        style={{ width: `${syncProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Button variant="ghost" onClick={handleSync} disabled={syncing}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sincronizar
                        </Button>
                    )}

                    <Button variant="secondary" onClick={() => setIsLinking(true)}>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Vincular Existente
                    </Button>

                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                        <Input
                            type="number"
                            min="1"
                            max="50"
                            value={createAmount}
                            onChange={(e) => setCreateAmount(parseInt(e.target.value) || 1)}
                            className="w-16 h-9"
                        />
                        <Button onClick={handleCreateGroups} disabled={isCreating}>
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Grupos
                        </Button>
                    </div>
                </div>
            </div>

            <GroupCreationProgress
                queue={queue}
                launchId={id}
                onRetrySuccess={fetchQueue}
            />

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Grupo</th>
                                <th className="px-4 py-3">Membros</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Link</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {groups.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        Nenhum grupo criado ainda. Utilize o botão acima para criar grupos.
                                    </td>
                                </tr>
                            ) : (
                                groups.map((group) => (
                                    <Fragment key={group.id}>
                                        <tr className={`hover:bg-slate-50 transition-colors ${expandedGroupId === group.id ? 'bg-slate-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-start gap-2">
                                                    <button
                                                        onClick={() => toggleGroupExpansion(group.id)}
                                                        className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        {expandedGroupId === group.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                    <div>
                                                        <div className="font-medium text-slate-900">{group.name}</div>
                                                        <div className="text-xs text-slate-400">#{group.number} • {group.remoteJid}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    <span className={group.memberCount >= (launch?.memberLimit || 256) ? 'text-red-500 font-medium' : ''}>
                                                        {group.memberCount}
                                                    </span>
                                                    <span className="text-slate-400">/ {launch?.memberLimit}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={() => handleToggleStatus(group.id, group.isReceiving)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${group.isReceiving ? 'bg-green-500' : 'bg-slate-200'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`${group.isReceiving ? 'translate-x-6' : 'translate-x-1'
                                                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                                        />
                                                    </button>
                                                    <span className="ml-2 text-xs text-slate-600">
                                                        {group.isReceiving ? 'Recebendo' : 'Pausado'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {group.inviteLink ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            readOnly
                                                            value={group.inviteLink}
                                                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs w-32 truncate"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await navigator.clipboard.writeText(group.inviteLink);
                                                                } catch (err) {
                                                                    const textArea = document.createElement('textarea');
                                                                    textArea.value = group.inviteLink;
                                                                    document.body.appendChild(textArea);
                                                                    textArea.select();
                                                                    document.execCommand('copy');
                                                                    document.body.removeChild(textArea);
                                                                }
                                                                setCopiedGroupId(group.id);
                                                                setTimeout(() => setCopiedGroupId(null), 2000);
                                                            }}
                                                            className="text-slate-500 hover:text-indigo-600 transition-colors"
                                                            title="Copiar link"
                                                        >
                                                            {copiedGroupId === group.id ? (
                                                                <Check className="w-4 h-4 text-green-500" />
                                                            ) : (
                                                                <Copy className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <a
                                                            href={group.inviteLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800"
                                                            title="Abrir link"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Sem link</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" title="Editar">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Remover do lançamento"
                                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedGroupId === group.id && (
                                            <tr>
                                                <td colSpan={5} className="p-0 pl-8 pr-4 pb-4 bg-slate-50 border-b border-l border-r border-slate-200">
                                                    <GroupParticipantsList
                                                        launchId={id}
                                                        groupId={group.id}
                                                        lastSyncTime={lastSyncTime}
                                                        expandedTimestamp={expandedTimestamp}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal de Vinculação */}
            {
                isLinking && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-lg">Vincular Grupos Existentes</h3>
                                <button onClick={() => setIsLinking(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="sr-only">Fechar</span>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-4 border-b border-slate-50 flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleGlobalSync}
                                    disabled={globalSyncing}
                                    className="w-full"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${globalSyncing ? 'animate-spin' : ''}`} />
                                    {globalSyncing ? 'Buscando do WhatsApp...' : 'Recarregar da Instância'}
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {globalLoading ? (
                                    <div className="text-center py-8 text-slate-500">Carregando grupos...</div>
                                ) : availableGroups.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <p>Nenhum grupo encontrado.</p>
                                        <p className="text-xs mt-1">Clique em &ldquo;Recarregar&rdquo; para buscar do WhatsApp.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {availableGroups.map(group => {
                                            const isLinked = groups.some(g => g.remoteJid === group.remoteJid);
                                            return (
                                                <label
                                                    key={group.id}
                                                    className={`flex items-center p-3 rounded border cursor-pointer hover:bg-slate-50 transition-colors ${selectedGroupIds.includes(group.remoteJid) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                                                        } ${isLinked ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={isLinked}
                                                        checked={selectedGroupIds.includes(group.remoteJid) || isLinked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedGroupIds([...selectedGroupIds, group.remoteJid]);
                                                            } else {
                                                                setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.remoteJid));
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                    />
                                                    <div className="ml-3 flex-1">
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-slate-900">{group.name}</span>
                                                            {isLinked && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Já vinculado</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex gap-2">
                                                            <span>{group.memberCount} membros</span>
                                                            <span>•</span>
                                                            <span className="truncate max-w-[200px]">{group.remoteJid}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                                <Button variant="ghost" onClick={() => setIsLinking(false)}>Cancelar</Button>
                                <Button onClick={handleLinkSubmit} disabled={selectedGroupIds.length === 0 || isLinkingSubmitting}>
                                    {isLinkingSubmitting ? 'Vinculando...' : `Vincular ${selectedGroupIds.length} Grupos`}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
