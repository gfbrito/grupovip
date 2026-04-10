'use client';

import { useState } from 'react';
import { ArrowLeft, ExternalLink, Copy, Check, Info } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Switch from '@/components/ui/Switch';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface LaunchHeaderProps {
    launch: {
        id: number;
        name: string;
        slug: string;
        status: string;
    };
}

export default function LaunchHeader({ launch: initialLaunch }: LaunchHeaderProps) {
    const [launch, setLaunch] = useState(initialLaunch);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const launchUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/l/${launch.slug}`
        : `.../l/${launch.slug}`;

    const copyLink = () => {
        navigator.clipboard.writeText(launchUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStatusToggle = async (active: boolean) => {
        const newStatus = active ? 'ACTIVE' : 'DRAFT';
        setLoading(true);
        try {
            await api.put(`/launches/${launch.id}`, { status: newStatus });
            setLaunch({ ...launch, status: newStatus });
            addToast({
                type: active ? 'success' : 'info',
                title: active ? 'Lançamento Ativo' : 'Rascunho',
                message: active ? 'O link de redirecionamento está ativo.' : 'O link agora redirecionará para uma página de espera.'
            });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            addToast({ type: 'error', title: 'Erro', message: 'Não foi possível atualizar o status.' });
        } finally {
            setLoading(false);
        }
    };

    const statusColors = {
        DRAFT: 'warning',
        ACTIVE: 'success',
        PAUSED: 'warning',
        ENDED: 'default',
    } as const;

    const statusLabels = {
        DRAFT: 'Rascunho',
        ACTIVE: 'Ativo',
        PAUSED: 'Pausado',
        ENDED: 'Encerrado',
    };

    return (
        <div className="mb-6">
            <Link
                href="/launches"
                className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 mb-4"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar para lançamentos
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">{launch.name}</h1>
                        <Badge variant={statusColors[launch.status as keyof typeof statusColors] || 'default'}>
                            {statusLabels[launch.status as keyof typeof statusLabels] || launch.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                        <span className="truncate max-w-[300px] bg-slate-50 px-2 py-1 rounded border border-slate-100 font-mono text-xs">
                            {launchUrl}
                        </span>
                        <button
                            onClick={copyLink}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-indigo-600"
                            title="Copiar link"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                        <a
                            href={launchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-indigo-600"
                            title="Abrir página"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${launch.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-500'}`}>
                                {launch.status === 'ACTIVE' ? 'Lançamento Ativo' : 'Modo Rascunho'}
                            </span>
                            <Switch
                                checked={launch.status === 'ACTIVE'}
                                onCheckedChange={handleStatusToggle}
                                disabled={loading}
                            />
                        </div>
                        <p className="text-xs text-slate-400">
                            {launch.status === 'ACTIVE' ? 'Recebendo leads' : 'Redirecionamento pausado'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
