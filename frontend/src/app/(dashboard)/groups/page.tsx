'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users, Edit2, X, Check, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';

interface Group {
    id: number;
    remoteJid: string;
    name: string;
    nickname: string | null;
    isActive: boolean;
    memberCount: number;
    syncedAt: string;
}

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editNickname, setEditNickname] = useState('');

    const toast = useToast();

    const fetchGroups = useCallback(async () => {
        try {
            const response = await api.get('/groups');
            setGroups(response.data.groups);
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await api.post('/groups/sync');
            toast.success(response.data.message);
            fetchGroups();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao sincronizar grupos');
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleActive = async (group: Group) => {
        try {
            await api.patch(`/groups/${group.id}`, { isActive: !group.isActive });
            setGroups((prev) =>
                prev.map((g) => (g.id === group.id ? { ...g, isActive: !g.isActive } : g))
            );
            toast.success(`Grupo ${!group.isActive ? 'ativado' : 'desativado'}`);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao atualizar grupo');
        }
    };

    const handleStartEdit = (group: Group) => {
        setEditingId(group.id);
        setEditNickname(group.nickname || '');
    };

    const handleSaveNickname = async (group: Group) => {
        try {
            await api.patch(`/groups/${group.id}`, { nickname: editNickname });
            setGroups((prev) =>
                prev.map((g) => (g.id === group.id ? { ...g, nickname: editNickname || null } : g))
            );
            setEditingId(null);
            toast.success('Apelido atualizado');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao atualizar apelido');
        }
    };

    const filteredGroups = groups.filter((group) => {
        const searchTerm = search.toLowerCase();
        return (
            group.name.toLowerCase().includes(searchTerm) ||
            group.nickname?.toLowerCase().includes(searchTerm)
        );
    });

    const activeCount = groups.filter((g) => g.isActive).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Grupos</h1>
                    <p className="text-slate-500 mt-1">
                        {groups.length} grupos • {activeCount} ativos
                    </p>
                </div>
                <Button onClick={handleSync} loading={syncing}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar
                </Button>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <Input
                    placeholder="Buscar grupos..."
                    icon={<Search className="w-5 h-5" />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Groups Grid */}
            {filteredGroups.length === 0 ? (
                <Card>
                    <Card.Body className="py-12 text-center">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-1">
                            {groups.length === 0 ? 'Nenhum grupo sincronizado' : 'Nenhum resultado encontrado'}
                        </h3>
                        <p className="text-slate-500">
                            {groups.length === 0
                                ? 'Clique em "Sincronizar" para buscar seus grupos do WhatsApp'
                                : 'Tente buscar por outro termo'}
                        </p>
                    </Card.Body>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.map((group) => (
                        <Card key={group.id} className={!group.isActive ? 'opacity-60' : ''}>
                            <Card.Body>
                                <div className="flex items-start gap-3">
                                    {/* Avatar placeholder */}
                                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg shrink-0">
                                        {(group.nickname || group.name).charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {/* Nome/Nickname editável */}
                                        {editingId === group.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Apelido"
                                                    value={editNickname}
                                                    onChange={(e) => setEditNickname(e.target.value)}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveNickname(group)}
                                                    className="p-1 text-green-500 hover:text-green-600"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-slate-900 truncate">
                                                    {group.nickname || group.name}
                                                </h3>
                                                <button
                                                    onClick={() => handleStartEdit(group)}
                                                    className="p-1 text-slate-300 hover:text-slate-500"
                                                    title="Editar apelido"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {group.nickname && (
                                            <p className="text-xs text-slate-400 truncate">{group.name}</p>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="default">
                                                <Users className="w-3 h-3 mr-1" />
                                                {group.memberCount}
                                            </Badge>
                                            <Badge variant={group.isActive ? 'success' : 'default'}>
                                                {group.isActive ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Toggle */}
                                    <button
                                        onClick={() => handleToggleActive(group)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${group.isActive ? 'bg-blue-500' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${group.isActive ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </Card.Body>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
