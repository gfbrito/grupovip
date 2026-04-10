'use client';

import { useEffect, useState } from 'react';
import { 
    Users, 
    Rocket, 
    Activity, 
    Smartphone, 
    Search,
    Shield,
    MoreVertical,
    Crown,
    Check,
    X as XIcon
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface GlobalStats {
    users: number;
    launches: number;
    leads: number;
    groups: number;
    whatsappServers: number;
    planDistribution: Array<{ plan: string; planName: string; count: number }>;
}

interface User {
    id: number;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    plan?: { name: string; displayName: string };
    stats: { launches: number; campaigns: number; leads: number };
}

export default function AdminUsersPage() {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const toast = useToast();

    // Estado do modal de alteração de plano/role (simples)
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, usersRes] = await Promise.all([
                api.get('/admin/stats'),
                api.get('/admin/users')
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data);
        } catch (error) {
            toast.error('Erro ao buscar dados administrativos');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Tem certeza que deseja DELETAR este usuário? Essa ação é irreversível.')) return;
        
        try {
            await api.delete(`/admin/users/${id}`);
            toast.success('Usuário removido');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao deletar usuário');
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Admin 👑</h1>
                <p className="text-slate-500">Métricas globais e gerenciamento de usuários do SaaS.</p>
            </div>

            {/* Metrics Grid */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Usuários Ativos</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.users}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Rocket className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Lançamentos</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.launches}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total de Leads</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.leads}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Instâncias WPP</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.whatsappServers}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Users List */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <h2 className="font-semibold text-slate-900">Assinantes da Plataforma</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar usuário..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Usuário</th>
                                <th className="px-6 py-3">Plano</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Lançamentos</th>
                                <th className="px-6 py-3">Leads Captados</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{user.name}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                            user.plan?.name === 'PRO' ? 'bg-purple-100 text-purple-700' :
                                            user.plan?.name === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            <Crown className="w-3 h-3 mr-1" />
                                            {user.plan?.displayName || 'Sem Plano'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                                            user.role === 'MASTER' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                            user.role === 'ADMIN' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                            'border-slate-200 bg-white text-slate-600'
                                        }`}>
                                            {user.role === 'MASTER' && <Shield className="w-3 h-3 mr-1" />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-slate-700">{user.stats.launches}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-slate-700">{user.stats.leads}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-red-500 hover:text-red-700 font-medium text-xs transition-colors"
                                        >
                                            Excluir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
