'use client';

import { useEffect } from 'react';
import { useAICredits } from '@/hooks/useAICredits';
import { Zap, Coins, History, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import api from '@/lib/api';
import { useState } from 'react';

export default function AICreditsPage() {
    const { 
        balance, 
        transactions, 
        packages, 
        loading, 
        fetchBalance, 
        fetchHistory, 
        fetchPackages,
        purchasePackage 
    } = useAICredits();
    const { addToast } = useToast();
    const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

    useEffect(() => {
        fetchBalance();
        fetchHistory();
        fetchPackages();
    }, [fetchBalance, fetchHistory, fetchPackages]);

    const handleCapture = async (orderId: string) => {
        try {
            const { data } = await api.post('/ai-credits/capture', { orderId });
            addToast({ type: 'success', title: 'Sucesso', message: data.message || 'Pagamento confirmado!' });
            setSelectedPkg(null);
            fetchBalance();
            fetchHistory();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: error.response?.data?.error || 'Erro ao capturar compra' });
        }
    };

    if (loading && !balance) {
        return <div className="p-8 text-center text-zinc-400 font-inter">Carregando...</div>;
    }

    const availableMonthly = balance?.availableMonthly || 0;
    const totalExtra = balance?.extraCredits || 0;
    const quota = balance?.monthlyQuota || 0;
    const used = balance?.monthlyUsed || 0;
    
    const percentageUsed = quota > 0 ? (used / quota) * 100 : 0;
    const isLow = percentageUsed > 80;

    return (
        <div className="p-8 max-w-6xl mx-auto font-inter space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-outfit text-zinc-100 flex items-center gap-3">
                        <Zap className="w-8 h-8 text-indigo-400" />
                        Créditos de IA
                    </h1>
                    <p className="text-zinc-400 mt-2">
                        Gerencie seu consumo mensal e adquira pacotes extras.
                    </p>
                </div>
            </div>

            {/* SEÇÃO DE SALDO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-indigo-400" />
                        Saldo Mensal Inclusivo
                    </h2>

                    {balance?.isUnlimited ? (
                        <div className="flex items-center gap-3 text-indigo-400 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
                            <CheckCircle2 className="w-6 h-6" />
                            <div>
                                <p className="font-semibold">Plano Ilimitado</p>
                                <p className="text-sm opacity-80">Você não tem limites de IA mensais.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-400">Usado: {used.toLocaleString('pt-BR')}</span>
                                <span className="text-zinc-400">Total: {quota.toLocaleString('pt-BR')}</span>
                            </div>
                            
                            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 rounded-full ${
                                        percentageUsed > 90 ? 'bg-red-500' : percentageUsed > 75 ? 'bg-orange-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <span className={`text-2xl font-bold ${isLow && totalExtra === 0 ? 'text-red-400' : 'text-zinc-100'}`}>
                                    {availableMonthly.toLocaleString('pt-BR')} <span className="text-sm font-normal text-zinc-500">créditos restantes</span>
                                </span>
                                <span className="text-xs text-zinc-500">
                                    Renova em: {new Date(new Date(balance?.lastResetAt || new Date()).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            
                            {isLow && totalExtra === 0 && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Seu saldo está acabando. Compre créditos extras para continuar usando a IA quando o mensal acabar.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-indigo-900/40 to-zinc-900 border border-indigo-500/30 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-400" />
                            Créditos Extras
                        </h2>
                        <p className="text-sm text-zinc-400 mt-2">
                            Créditos pré-pagos que não expiram e são usados quando o saldo mensal acaba.
                        </p>
                    </div>
                    
                    <div className="mt-6">
                        <span className="text-4xl font-bold text-zinc-100">
                            {totalExtra.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-zinc-500 block mt-1">tokens disponíveis</span>
                    </div>
                </div>
            </div>

            {/* PACOTES (Só exibe se não for ilimitado) */}
            {!balance?.isUnlimited && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-zinc-100">Comprar Créditos Extras</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {packages.map((pkg) => (
                            <div key={pkg.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col hover:border-indigo-500/50 transition-colors">
                                <h3 className="text-xl font-bold text-zinc-100">{pkg.name}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-indigo-400">
                                        R$ {pkg.priceBRL.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                <div className="mt-4 bg-zinc-950 rounded-lg p-3 text-center border border-zinc-800">
                                    <span className="text-sm text-zinc-400">Inclui</span>
                                    <p className="font-bold text-zinc-100">{pkg.tokens.toLocaleString('pt-BR')} créditos</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedPkg(pkg.id)}
                                    className="mt-6 w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    Comprar Pacote
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTÓRICO */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Histórico de Uso
                </h2>
                
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="bg-zinc-950 text-zinc-500 uppercase">
                            <tr>
                                <th className="px-6 py-4 font-medium">Data</th>
                                <th className="px-6 py-4 font-medium">Operação</th>
                                <th className="px-6 py-4 font-medium">Modelo</th>
                                <th className="px-6 py-4 font-medium">Fonte</th>
                                <th className="px-6 py-4 font-medium text-right">Créditos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                        Nenhum uso de IA registrado ainda.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {new Date(t.createdAt).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-zinc-300">
                                            {t.operation}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs">
                                                {t.model}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {t.source === 'MONTHLY' ? (
                                                <span className="text-blue-400">Mensal</span>
                                            ) : t.source === 'UNLIMITED' ? (
                                                <span className="text-indigo-400">Ilimitado</span>
                                            ) : (
                                                <span className="text-orange-400">Extra</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-zinc-300 text-red-400">
                                            -{t.creditsUsed}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE PAGAMENTO PAYPAL */}
            {selectedPkg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                        <button 
                            onClick={() => setSelectedPkg(null)} 
                            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h3 className="text-xl font-bold text-zinc-100 mb-2">Finalizar Compra</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Você está adquirindo o pacote <strong>{packages.find(p => p.id === selectedPkg)?.name}</strong>.
                        </p>

                        <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-xl mb-6 flex justify-between items-center">
                            <span className="text-zinc-400">Total a pagar:</span>
                            <span className="text-2xl font-bold text-indigo-400">
                                R$ {packages.find(p => p.id === selectedPkg)?.priceBRL.toFixed(2).replace('.', ',')}
                            </span>
                        </div>

                        {process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? (
                            <PayPalScriptProvider options={{ 
                                clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID, 
                                currency: "BRL" 
                            }}>
                                <PayPalButtons 
                                    style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
                                    createOrder={async () => {
                                        const res = await purchasePackage(selectedPkg);
                                        return res.orderId; // Retorna a Order criada no Backend
                                    }}
                                    onApprove={async (data, actions) => {
                                        await handleCapture(data.orderID);
                                    }}
                                    onError={(err) => {
                                        addToast({ type: 'error', title: 'Erro', message: 'Ocorreu um erro no Widget do PayPal.' });
                                        console.error(err);
                                    }}
                                />
                            </PayPalScriptProvider>
                        ) : (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl text-sm text-center">
                                O Gateway de Pagamento ainda não foi configurado pelo Administrador.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
