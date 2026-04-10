import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface GroupCreationQueueItem {
    id: number;
    name: string;
    number: number;
    status: string;
    scheduledAt: string;
    error?: string;
}

interface GroupCreationProgressProps {
    queue: GroupCreationQueueItem[];
    launchId?: string;
    onRetrySuccess?: () => void;
}

export default function GroupCreationProgress({ queue, launchId, onRetrySuccess }: GroupCreationProgressProps) {
    const [showErrors, setShowErrors] = useState(false);
    const [retryingIds, setRetryingIds] = useState<number[]>([]);
    const { addToast } = useToast();

    if (queue.length === 0) return null;

    const pending = queue.filter(q => q.status === 'PENDING').length;
    const creating = queue.filter(q => q.status === 'CREATING').length;
    const completed = queue.filter(q => q.status === 'COMPLETED').length;
    const failedItems = queue.filter(q => q.status === 'FAILED');
    const failed = failedItems.length;

    const total = queue.length;
    const percent = Math.round((completed / total) * 100);

    // Se tudo completou (com ou sem erros), não mostrar barra de progresso grande se não houver erros para ver
    const isFinished = pending === 0 && creating === 0;

    if (isFinished && failed === 0) return null;

    const handleRetry = async (queueId: number) => {
        if (!launchId) return;

        setRetryingIds(prev => [...prev, queueId]);
        try {
            await api.post(`/launches/${launchId}/groups/queue/${queueId}/retry`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Item recolocado na fila.' });
            if (onRetrySuccess) onRetrySuccess();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao tentar novamente.' });
        } finally {
            setRetryingIds(prev => prev.filter(id => id !== queueId));
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    {creating > 0 ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            Criando grupos...
                        </>
                    ) : failed > 0 ? (
                        <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Processo finalizado com erros
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Criação finalizada
                        </>
                    )}
                </h3>
                <span className="text-sm text-slate-500">
                    {completed}/{total} grupos
                </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${failed > 0 ? 'bg-red-500' : 'bg-indigo-600'}`}
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500 items-center justify-between">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        {pending} na fila
                    </span>
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        {creating} criando
                    </span>
                    <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {completed} prontos
                    </span>
                    {failed > 0 && (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {failed} falhas
                        </span>
                    )}
                </div>

                {failed > 0 && (
                    <button
                        onClick={() => setShowErrors(!showErrors)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                        {showErrors ? 'Ocultar erros' : 'Ver erros'}
                        {showErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Próximo da fila */}
            {pending > 0 && !showErrors && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Próximo grupo em: {new Date(queue.find(q => q.status === 'PENDING')?.scheduledAt || '').toLocaleTimeString()}
                </div>
            )}

            {/* Lista de Erros */}
            {showErrors && (
                <div className="mt-3 pt-3 border-t border-red-100">
                    <p className="text-xs font-semibold text-red-700 mb-2">Log de Falhas:</p>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {failedItems.map((item, index) => (
                            <div key={index} className="bg-red-50 p-3 rounded border border-red-100 text-xs flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    <p className="font-medium text-red-800 flex justify-between">
                                        <span>{item.name}</span>
                                        <span className="opacity-70">#{item.number}</span>
                                    </p>
                                    <p className="text-red-600 mt-1 font-mono break-all">{item.error || 'Erro desconhecido'}</p>
                                </div>
                                {launchId && (
                                    <button
                                        onClick={() => handleRetry(item.id)}
                                        disabled={retryingIds.includes(item.id)}
                                        className="p-1.5 bg-white border border-red-200 rounded text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                                        title="Tentar novamente"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${retryingIds.includes(item.id) ? 'animate-spin' : ''}`} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
