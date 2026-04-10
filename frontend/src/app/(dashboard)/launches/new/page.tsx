'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function NewLaunchPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        logoUrl: '',
        initialGroups: 5,
        memberLimit: 250, // Padrão menor para não lotar muito rápido e testar
        groupNamePattern: '{nome} - Grupo {n}',
        groupDescription: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/launches', formData);
            addToast({
                type: 'success',
                title: 'Sucesso',
                message: 'Lançamento criado com sucesso!',
            });
            router.push(`/launches/${response.data.launch.id}`);
        } catch (error: any) {
            console.error('Erro ao criar lançamento:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.response?.data?.error || 'Erro ao criar lançamento.',
            });
        } finally {
            setLoading(false);
        }
    };

    const [magicModalOpen, setMagicModalOpen] = useState(false);
    const [magicProductInfo, setMagicProductInfo] = useState('');
    const [magicEventDate, setMagicEventDate] = useState('');
    const [magicLoading, setMagicLoading] = useState(false);

    const handleMagicGenerate = async () => {
        if (!magicProductInfo || magicProductInfo.trim().length < 10) {
            addToast({ type: 'warning', title: 'Atenção', message: 'Descreva melhor o seu produto.' });
            return;
        }

        setMagicLoading(true);
        try {
            const response = await api.post('/launches/magic-generate', { 
                productInfo: magicProductInfo,
                eventDate: magicEventDate 
            });
            addToast({
                type: 'success',
                title: 'Mágica Realizada! 🪄',
                message: response.data.message || 'Lançamento estruturado com IA!',
            });
            router.push(`/launches/${response.data.launch.id}`);
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro na IA',
                message: error.response?.data?.error || 'Erro ao gerar lançamento.',
            });
        } finally {
            setMagicLoading(false);
            setMagicModalOpen(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <Link
                href="/launches"
                className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar para lançamentos
            </Link>

            <div className="mb-8 flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Novo Lançamento</h1>
                    <p className="text-slate-500 mt-1">Configure os detalhes iniciais do seu lançamento</p>
                </div>
                {user?.enableAI !== false && (
                    <Button 
                        variant="default"
                        onClick={() => setMagicModalOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-0 text-white shadow-md hover:shadow-lg transition-all"
                    >
                        <Sparkles className="w-4 h-4" />
                        Gerar com IA (15 Cr)
                    </Button>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="mb-6">
                    <Card.Header>
                        <h2 className="font-semibold text-slate-900">Informações Básicas</h2>
                    </Card.Header>
                    <Card.Body className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome do Lançamento
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Maratona Digital 3.0"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Este nome será usado para gerar o link público e identificar o lançamento.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">URL da Logo (Opcional)</label>
                            <Input
                                value={formData.logoUrl}
                                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                placeholder="https://exemplo.com/logo.png"
                            />
                            <p className="text-xs text-slate-500 mt-1">Recomendado: Imagem quadrada (ex: 500x500px).</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Descrição Interna
                            </label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Ex: Lançamento para lista fria de Agosto"
                            />
                        </div>
                    </Card.Body>
                </Card>

                <Card className="mb-6">
                    <Card.Header>
                        <h2 className="font-semibold text-slate-900">Configuração de Grupos</h2>
                    </Card.Header>
                    <Card.Body className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Grupos Iniciais
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={formData.initialGroups}
                                    onChange={(e) => setFormData({ ...formData, initialGroups: parseInt(e.target.value) || 0 })}
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Quantidade de grupos para criar imediatamente na fila.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Limite de Membros
                                </label>
                                <Input
                                    type="number"
                                    min="10"
                                    max="1024"
                                    value={formData.memberLimit}
                                    onChange={(e) => setFormData({ ...formData, memberLimit: parseInt(e.target.value) || 0 })}
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Limite de leads para redirecionar para o próximo grupo.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Padrão de Nome dos Grupos
                            </label>
                            <Input
                                value={formData.groupNamePattern}
                                onChange={(e) => setFormData({ ...formData, groupNamePattern: e.target.value })}
                                placeholder="{nome} - Grupo {n}"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Variáveis: <code>{'{nome}'}</code> (nome do lançamento), <code>{'{n}'}</code> (número do grupo sequencial).
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Descrição dos Grupos (WhatsApp)
                            </label>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={4}
                                value={formData.groupDescription}
                                onChange={(e) => setFormData({ ...formData, groupDescription: e.target.value })}
                                placeholder="Regras do grupo, links importantes, etc."
                            />
                        </div>
                    </Card.Body>
                </Card>

                <div className="flex justify-end gap-3">
                    <Link href="/launches">
                        <Button type="button" variant="ghost" onClick={() => router.back()}>
                            Cancelar
                        </Button>
                    </Link>
                    <Button type="submit" disabled={loading} className="min-w-[120px]">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            'Criar Lançamento'
                        )}
                    </Button>
                </div>
            </form>

            <Modal
                isOpen={magicModalOpen}
                onClose={() => !magicLoading && setMagicModalOpen(false)}
                title="Lançamento Mágico com IA 🪄"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Descreva seu produto ou nicho detalhadamente. Nossa IA criará a estrutura completa: 
                        nomes persuasivos, descrições, grupos de WhatsApp e 3 dias de mensagens de aquecimento.
                        <br/><br/>
                        <span className="font-semibold text-purple-600">Custo: 15 Créditos IA</span>
                    </p>
                    <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 h-32 resize-none"
                        placeholder="Ex: Curso de Marketing Digital para maquiadoras, ensinando como captar clientes pelo Instagram sem investir em tráfego pago. Foco em autoridade e conexão."
                        value={magicProductInfo}
                        onChange={(e) => setMagicProductInfo(e.target.value)}
                        disabled={magicLoading}
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Data Prevista (Opcional)
                        </label>
                        <Input
                            type="date"
                            value={magicEventDate}
                            onChange={(e) => setMagicEventDate(e.target.value)}
                            disabled={magicLoading}
                        />
                        <p className="text-xs text-slate-500 mt-1">A IA usará isso para embasar a comunicação das mensagens prováveis.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setMagicModalOpen(false)}
                            disabled={magicLoading}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleMagicGenerate}
                            disabled={magicLoading}
                            className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                        >
                            {magicLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Realizando Mágica...
                                </>
                            ) : (
                                'Gerar Lançamento'
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
