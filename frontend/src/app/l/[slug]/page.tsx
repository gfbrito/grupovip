'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface LaunchRedirectData {
    status: 'ok' | 'full' | 'error';
    redirectUrl?: string;
    message?: string;
    linkType?: string;
    launch?: {
        name: string;
        description: string;
    };
    tracking?: {
        metaPixelEnabled: boolean;
        metaPixelId?: string;
        metaPixelEvents?: string[];
        gtmEnabled: boolean;
        gtmId?: string;
    };
}

export default function LaunchRedirectPage() {
    const params = useParams();
    const slug = params?.slug as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LaunchRedirectData | null>(null);

    useEffect(() => {
        if (slug) {
            handleRedirect();
        }
    }, [slug]);

    const handleRedirect = async () => {
        try {
            // 1. Buscar dados de redirecionamento
            // Usamos fetch direto pois pode ser um endpoint público sem auth, 
            // mas no backend definimos como rota de API. 
            // Se for rota pública, não deve ir via `api` interceptor que exige auth.
            // O backend definiu `/l/:slug` na raiz das rotas ou dentro de `/api`?
            // No routes/index.ts, definimos `router.get('/l/:slug', ...)` dentro de `/api`?
            // Sim, `router.use('/api', routes)`. Então é `/api/l/:slug`.
            // Mas para o usuário final seria bom `/l/:slug` na raiz do site frontend.
            // E o frontend chama o backend.

            // Assumindo que o usuário acessa `frontend.com/l/slug` e essa página faz fetch no backend.
            // O backend rota é `/api/l/:slug`. 
            // A rota backend NÃO deve exigir auth.
            // Verifiquei o backend: `router.get('/l/:slug', ...)` está APÓS os middlewares? 
            // Está no `index.ts`, e NÃO tem `authMiddleware`. Perfeito.

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/l/${slug}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Lançamento não encontrado');
            }

            setData(result);

            if (result.status === 'ok' && result.redirectUrl) {
                // 2. Disparar pixels/tracking
                triggerTracking(result.tracking);

                // 3. Redirecionar
                // Pequeno delay para garantir que pixels disparem e para UX
                setTimeout(() => {
                    window.location.href = result.redirectUrl;
                }, 800);
            } else if (result.status === 'full') {
                setLoading(false);
            } else {
                setError('Não foi possível redirecionar.');
                setLoading(false);
            }

        } catch (err: any) {
            console.error('Erro no redirecionamento:', err);
            setError(err.message || 'Erro ao processar redirecionamento');
            setLoading(false);
        }
    };

    const triggerTracking = (tracking: any) => {
        if (!tracking) return;

        // Meta Pixel
        if (tracking.metaPixelEnabled && tracking.metaPixelId) {
            import('react-facebook-pixel')
                .then((x) => x.default)
                .then((ReactPixel) => {
                    ReactPixel.init(tracking.metaPixelId);
                    ReactPixel.pageView();

                    if (tracking.metaPixelEvents) {
                        tracking.metaPixelEvents.forEach((event: string) => {
                            ReactPixel.track(event);
                        });
                    }
                });
        }

        // GTM
        if (tracking.gtmEnabled && tracking.gtmId) {
            // Implementação GTM simplificada ou via lib
            // Se o projeto já tiver GTM configurado no layout, talvez apenas push no dataLayer
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({ event: 'launch_redirect', slug });
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 font-medium animate-pulse">
                    Redirecionando para o grupo do WhatsApp...
                </p>
            </div>
        );
    }

    if (data?.status === 'full') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center">
                    <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Grupos Cheios</h1>
                    <p className="text-slate-600 mb-6">
                        {data.message || 'No momento todos os nossos grupos estão cheios. Tente novamente mais tarde.'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full"
                    >
                        Tentar Novamente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
                <p className="text-slate-600 mb-6">{error || 'Não foi possível encontrar o grupo.'}</p>
                <p className="text-xs text-slate-400">Slug: {slug}</p>
            </div>
        </div>
    );
}
