'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Rocket, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function LaunchesPage() {
    const [launches, setLaunches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    // Estado do Modal de Exclusão
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [launchToDelete, setLaunchToDelete] = useState<{ id: number, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchLaunches();
    }, []);

    const fetchLaunches = async () => {
        try {
            const response = await api.get('/launches');
            setLaunches(response.data.launches);
        } catch (error) {
            console.error('Erro ao buscar lançamentos:', error);
            addToast({
                type: 'error',
                title: 'Erro',
                message: 'Não foi possível carregar os lançamentos.',
            });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (e: React.MouseEvent, id: number, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        setLaunchToDelete({ id, name });
        setDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!launchToDelete) return;

        setIsDeleting(true);
        try {
            await api.delete(`/launches/${launchToDelete.id}`);
            addToast({ type: 'success', title: 'Sucesso', message: 'Lançamento excluído.' });
            fetchLaunches();
            setDeleteModalOpen(false);
            setLaunchToDelete(null);
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', message: 'Erro ao excluir lançamento.' });
        } finally {
            setIsDeleting(false);
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
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Lançamentos</h1>
                    <p className="text-slate-500 mt-1">Gerencie seus lançamentos e grupos de WhatsApp</p>
                </div>
                <Link href="/launches/new">
                    <Button className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Lançamento
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : launches.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                        <Rocket className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lançamento encontrado</h3>
                    <p className="text-slate-500 mb-6">Crie seu primeiro lançamento para começar a captar leads.</p>
                    <Link href="/launches/new">
                        <Button>Criar Lançamento</Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {launches.map((launch) => (
                        <Link key={launch.id} href={`/launches/${launch.id}`} className="block group">
                            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-slate-200 group-hover:border-indigo-200 relative">
                                <Card.Header className="flex items-start gap-4 pb-4">
                                    <div className="flex-shrink-0">
                                        {launch.logoUrl ? (
                                            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-slate-200">
                                                <img
                                                    src={launch.logoUrl}
                                                    alt={launch.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 text-indigo-600 font-bold text-xl">
                                                {launch.name.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-semibold text-slate-900 truncate hover:text-indigo-600 transition-colors text-lg">
                                                {launch.name}
                                            </h3>
                                            <button
                                                onClick={(e) => confirmDelete(e, launch.id, launch.name)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                                                title="Excluir Lançamento"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs text-slate-500">
                                                Criado em {new Date(launch.createdAt).toLocaleDateString('pt-BR')}
                                            </p>
                                            <Badge variant={statusColors[launch.status as keyof typeof statusColors] || 'default'} className="scale-90 origin-left">
                                                {statusLabels[launch.status as keyof typeof statusLabels] || launch.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </Card.Header>

                                <Card.Body className="pt-0">
                                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t pt-4">
                                        <span>{launch.stats?.totalGroups || 0} Grupos</span>
                                        <span>{launch.stats?.totalLeads || 0} Total Leads</span>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setLaunchToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Excluir Lançamento"
                message={`Tem certeza que deseja excluir o lançamento "${launchToDelete?.name}"? Esta ação não pode ser desfeita e todos os dados associados serão perdidos.`}
                confirmText="Excluir Permanentemente"
                isDestructive
                isLoading={isDeleting}
            />
        </div>
    );
}
