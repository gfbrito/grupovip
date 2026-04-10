'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Users,
    Send,
    Settings,
    LogOut,
    MessageSquare,
    Menu,
    X,
    Rocket,
    Crown,
    Lock,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApiConfig } from '@/hooks/useApiConfig';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { AICreditsWidget } from '@/components/ui/AICreditsWidget';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Lançamentos', href: '/launches', icon: Rocket },
    { name: 'Grupos', href: '/groups', icon: Users },
    { name: 'Campanhas', href: '/campaigns', icon: Send },
    { name: 'Configurações', href: '/settings', icon: Settings },
];

const adminNavigation = [
    { name: 'Usuários', href: '/admin/users', icon: Users },
    { name: 'Planos', href: '/admin/plans', icon: Crown },
    { name: 'Cofre', href: '/admin/settings', icon: Lock },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'loading' | 'not_configured'>('loading');
    const [workerStatus, setWorkerStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');

    const { user, loading: authLoading, logout } = useAuth();
    const { isConfigured, loading: configLoading } = useApiConfig();
    const router = useRouter();
    const pathname = usePathname();
    const toast = useToast();

    // Verificar autenticação
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    // Verificar configuração e redirecionar se necessário
    useEffect(() => {
        if (!configLoading && !isConfigured && pathname !== '/settings') {
            toast.warning('Configure a API para continuar');
            router.push('/settings');
        }
    }, [configLoading, isConfigured, pathname, router, toast]);

    // Buscar status da API e worker
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await api.get('/status');
                setApiStatus(response.data.api);
                setWorkerStatus(response.data.worker === 'running' ? 'connected' : 'disconnected');
            } catch {
                setApiStatus('disconnected');
                setWorkerStatus('disconnected');
            }
        };

        if (user) {
            fetchStatus();
            const interval = setInterval(fetchStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900">WPP Sender</h1>
                            <p className="text-xs text-slate-500">Disparo de mensagens</p>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            );
                        })}

                        {/* Admin Section - Only for MASTER users */}
                        {user.role === 'MASTER' && (
                            <>
                                <div className="pt-4 pb-2">
                                    <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Administração
                                    </p>
                                </div>
                                {adminNavigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                                ? 'bg-amber-50 text-amber-600'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <item.icon className="w-5 h-5 text-amber-500" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </>
                        )}
                    </nav>

                    {/* User */}
                    <div className="border-t border-slate-100 px-4 py-4">
                        {/* Plan Badge */}
                        {user.plan && (
                            <div className="px-3 py-2 mb-2">
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${user.plan.name === 'FREE' ? 'bg-slate-100 text-slate-600' :
                                    user.plan.name === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                                        user.plan.name === 'PRO' ? 'bg-purple-100 text-purple-700' :
                                            'bg-amber-100 text-amber-700'
                                    }`}>
                                    <Crown className="w-3 h-3" />
                                    {user.plan.displayName}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-medium">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50"
                                title="Sair"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between px-4 lg:px-8 py-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-6 ml-auto">
                            {user.enableAI !== false && <AICreditsWidget />}
                            <div className="hidden sm:flex items-center gap-6 border-l border-slate-200 pl-6">
                                <StatusIndicator status={apiStatus} label="API" />
                                <StatusIndicator status={workerStatus} label="Worker" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
