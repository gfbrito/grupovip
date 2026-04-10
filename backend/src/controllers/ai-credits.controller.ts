import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AICreditsService } from '../services/ai-credits.service';
import axios from 'axios';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

const getPayPalAccessToken = async () => {
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const response = await axios.post(
        `${PAYPAL_API}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    return response.data.access_token;
};

export const getBalance = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const balance = await AICreditsService.getBalance(userId);
        res.json({ balance });
    } catch (error) {
        console.error('[AICredits] Erro ao buscar saldo:', error);
        res.status(500).json({ error: 'Erro ao buscar saldo' });
    }
};

export const getHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { limit = 20, offset = 0 } = req.query;

        const transactions = await prisma.aITransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset)
        });

        const total = await prisma.aITransaction.count({
            where: { userId }
        });

        res.json({ transactions, total });
    } catch (error) {
        console.error('[AICredits] Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
};

export const getPackages = async (req: Request, res: Response) => {
    // Para simplificar, estamos retornando pacotes fixos.
    // Em um sistema real, isso poderia vir de uma tabela do banco de dados ou do gateway de pagamento.
    const packages = [
        { id: 'starter', name: 'Starter', tokens: 50000, priceBRL: 9.90 },
        { id: 'plus', name: 'Plus', tokens: 200000, priceBRL: 29.90 },
        { id: 'pro', name: 'Pro', tokens: 500000, priceBRL: 59.90 },
        { id: 'ultra', name: 'Ultra', tokens: 2000000, priceBRL: 199.90 }
    ];

    res.json({ packages });
};

export const purchaseCredits = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { packageId } = req.body;
        
        // Simulação: encontra pacote
        const packages = [
            { id: 'starter', name: 'Starter', tokens: 50000, priceBRL: 9.90 },
            { id: 'plus', name: 'Plus', tokens: 200000, priceBRL: 29.90 },
            { id: 'pro', name: 'Pro', tokens: 500000, priceBRL: 59.90 },
            { id: 'ultra', name: 'Ultra', tokens: 2000000, priceBRL: 199.90 }
        ];

        const pkg = packages.find(p => p.id === packageId);
        if (!pkg) {
            return res.status(400).json({ error: 'Pacote inválido' });
        }

        // Criar registro de compra pendente
        const purchase = await prisma.aICreditPurchase.create({
            data: {
                userId,
                packageName: pkg.name,
                tokensAmount: pkg.tokens,
                priceBRL: pkg.priceBRL,
                status: 'PENDING',
                paymentMethod: 'PAYPAL'
            }
        });

        // Autenticar com o PayPal
        const accessToken = await getPayPalAccessToken();

        // Criar pedido no PayPal
        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: purchase.id.toString(),
                    description: `Pacote: ${pkg.name} - Créditos Extras de IA`,
                    amount: {
                        currency_code: 'BRL',
                        value: pkg.priceBRL.toFixed(2).toString()
                    }
                }
            ]
        };

        const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, orderPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Extrai o orderId provido na API
        const orderId = response.data.id;
        
        // Obter o url de approuve (opcional se renderizar os botões via web, útil para fallbacks)
        const approveLink = response.data.links.find((l: any) => l.rel === 'approve');

        // Atualizar tablela para conter a ID da transaction/order originada (paymentRef)
        await prisma.aICreditPurchase.update({
            where: { id: purchase.id },
            data: { paymentRef: orderId }
        });

        res.json({ 
            purchaseId: purchase.id,
            orderId: orderId,
            checkoutUrl: approveLink ? approveLink.href : null,
            message: 'Pedido PayPal gerado.' 
        });

    } catch (error) {
        console.error('[AICredits] Erro ao iniciar compra:', error);
        res.status(500).json({ error: 'Erro ao iniciar compra de créditos' });
    }
};

export const capturePurchase = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ error: 'orderId obrigatório' });
        }

        // Busca o purchase pendente com essa referência
        const purchase = await prisma.aICreditPurchase.findFirst({
            where: { paymentRef: orderId, status: 'PENDING' }
        });

        if (!purchase) {
            return res.status(404).json({ error: 'Compra não encontrada ou já processada' });
        }

        const accessToken = await getPayPalAccessToken();

        // Faz o capture oficial com o PayPal
        const response = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status === 'COMPLETED') {
            // Atualiza status no banco da compra
            await prisma.aICreditPurchase.update({
                where: { id: purchase.id },
                data: {
                    status: 'PAID',
                    paidAt: new Date()
                }
            });

            // Libera os créditos extras para o usuário
            await AICreditsService.addExtraCredits(purchase.userId, purchase.tokensAmount);

            return res.json({ success: true, message: 'Pagamento confirmado e créditos liberados!' });
        } else {
            return res.status(400).json({ error: 'O pagamento não foi completado pelo PayPal' });
        }

    } catch (error: any) {
        console.error('[AICredits] Erro ao capturar pagamento:', error?.response?.data || error);
        res.status(500).json({ error: 'Erro ao confirmar compra' });
    }
};
