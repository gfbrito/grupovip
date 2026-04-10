import React from 'react';

interface StatusIndicatorProps {
    status: 'connected' | 'disconnected' | 'loading' | 'not_configured';
    label: string;
    className?: string;
}

export function StatusIndicator({ status, label, className = '' }: StatusIndicatorProps) {
    const colors = {
        connected: 'bg-green-500',
        disconnected: 'bg-red-500',
        loading: 'bg-amber-500 animate-pulse',
        not_configured: 'bg-slate-400',
    };

    const labels = {
        connected: 'Conectado',
        disconnected: 'Desconectado',
        loading: 'Verificando...',
        not_configured: 'Não configurado',
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${colors[status]}`} />
            <span className="text-sm text-slate-600">
                {label}: <span className="font-medium">{labels[status]}</span>
            </span>
        </div>
    );
}

export default StatusIndicator;
