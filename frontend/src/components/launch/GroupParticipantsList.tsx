import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Search, RefreshCw } from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface GroupParticipantsListProps {
    launchId: string;
    groupId: number;
    lastSyncTime?: number;
    expandedTimestamp?: number;
}

export default function GroupParticipantsList({ launchId, groupId, lastSyncTime, expandedTimestamp }: GroupParticipantsListProps) {
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch leads filtering by this specific group
            const res = await api.get(`/launches/${launchId}/leads?groupId=${groupId}&page=${page}&limit=10`);
            setLeads(res.data.leads);
            setTotal(res.data.pagination.total);
        } catch (error) {
            console.error('Erro ao buscar participantes:', error);
        } finally {
            setLoading(false);
        }
    }, [launchId, groupId, page]);

    useEffect(() => {
        fetchLeads();
    }, [page, lastSyncTime, expandedTimestamp, fetchLeads]);

    if (loading && leads.length === 0) {
        return <div className="p-4 text-center text-sm text-slate-500">Carregando participantes...</div>;
    }

    if (leads.length === 0) {
        return <div className="p-4 text-center text-sm text-slate-500">Nenhum participante encontrado neste grupo.</div>;
    }

    return (
        <div className="bg-slate-50 p-4 rounded-b-lg border-x border-b border-slate-200 shadow-inner">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">
                    Participantes ({total})
                </h4>
                <button
                    onClick={fetchLeads}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    disabled={loading}
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            <div className="overflow-hidden rounded border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-medium">
                        <tr>
                            <th className="px-3 py-2">Telefone</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Entrada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leads.map((lead) => (
                            <tr key={lead.id}>
                                <td className="px-3 py-2 font-mono text-slate-600">{lead.phone}</td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${lead.activeGroups > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {lead.activeGroups > 0 ? 'Ativo' : 'Saiu'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                    {/* Encontrar a data de entrada neste grupo específico */}
                                    {(() => {
                                        const connection = lead.groups.find((g: any) => g.group?.id === groupId || g.groupId === groupId);
                                        return connection?.joinedAt ? new Date(connection.joinedAt).toLocaleString() : '-';
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Simples paginação se houver mais de 10 */}
            {total > 10 && (
                <div className="flex justify-center gap-2 mt-3">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2 py-1 text-xs border rounded bg-white disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <span className="text-xs py-1 text-slate-500">Pág {page}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * 10 >= total}
                        className="px-2 py-1 text-xs border rounded bg-white disabled:opacity-50"
                    >
                        Próxima
                    </button>
                </div>
            )}
        </div>
    );
}
