import { Router, Response, Request } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { configGuardMiddleware } from '../middlewares/config-guard.middleware';
import { requireMaster } from '../middlewares/role.middleware';

// Controllers
import * as authController from '../controllers/auth.controller';
import * as settingsController from '../controllers/settings.controller';
import * as whatsappServersController from '../controllers/whatsapp-servers.controller';
import * as groupsController from '../controllers/groups.controller';
import * as campaignsController from '../controllers/campaigns.controller';
import * as launchController from '../controllers/launch.controller';
import * as launchGroupsController from '../controllers/launch-groups.controller';
import * as launchLeadsController from '../controllers/launch-leads.controller';
import * as launchActionsController from '../controllers/launch-actions.controller';
import * as launchMessagesController from '../controllers/launch-messages.controller';
import * as launchWebhooksController from '../controllers/launch-webhooks.controller';
import * as webhookController from '../controllers/webhook.controller';
import * as plansController from '../controllers/plans.controller';
import * as adminController from '../controllers/admin.controller';
import * as aiCreditsController from '../controllers/ai-credits.controller';
import * as analyticsController from '../controllers/analytics.controller';
import uploadRoutes from './upload.routes';

// Services
import { evolutionClient } from '../services/evolution.client';
import { isWorkerRunning } from '../services/queue.worker';
import { prisma } from '../config/database';

const router = Router();

// ========================
// Auth Routes (públicas)
// ========================
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authMiddleware, authController.me);

// ========================
// Plans Routes
// ========================
router.get('/plans', authMiddleware, plansController.listPlans);
router.get('/plans/:id', authMiddleware, plansController.getPlan);
router.post('/plans', authMiddleware, requireMaster(), plansController.createPlan);
router.put('/plans/:id', authMiddleware, requireMaster(), plansController.updatePlan);
router.delete('/plans/:id', authMiddleware, requireMaster(), plansController.deletePlan);
router.get('/plans/:id/users', authMiddleware, requireMaster(), plansController.getPlanUsers);
router.put('/users/:userId/plan', authMiddleware, requireMaster(), plansController.changeUserPlan);
router.get('/my-usage', authMiddleware, plansController.getMyUsage);

// ========================
// Admin Routes (MASTER only)
// ========================
router.get('/admin/stats', authMiddleware, requireMaster(), adminController.getSystemStats);
router.get('/admin/users', authMiddleware, requireMaster(), adminController.listUsers);
router.get('/admin/users/:id', authMiddleware, requireMaster(), adminController.getUser);
router.put('/admin/users/:id/role', authMiddleware, requireMaster(), adminController.updateUserRole);
router.delete('/admin/users/:id', authMiddleware, requireMaster(), adminController.deleteUser);
router.get('/admin/config', authMiddleware, requireMaster(), adminController.getMasterConfig);
router.put('/admin/config', authMiddleware, requireMaster(), adminController.updateMasterConfig);

// ========================
// Upload Routes
// ========================
router.use(uploadRoutes);

// ========================
// Outras Rotas (Grupos, Servidores, etc)es
// ========================
router.get('/settings', authMiddleware, settingsController.getSettings);
router.put('/settings', authMiddleware, requireMaster(), settingsController.updateSettings);
router.post('/settings/test', authMiddleware, requireMaster(), settingsController.testConnection);

// ========================
// WhatsApp Servers Routes
// ========================
router.get('/whatsapp-servers', authMiddleware, whatsappServersController.listServers);
router.post('/whatsapp-servers', authMiddleware, whatsappServersController.createServer);
router.put('/whatsapp-servers/reorder', authMiddleware, whatsappServersController.reorderServers);
router.get('/whatsapp-servers/:id', authMiddleware, whatsappServersController.getServer);
router.put('/whatsapp-servers/:id', authMiddleware, whatsappServersController.updateServer);
router.delete('/whatsapp-servers/:id', authMiddleware, whatsappServersController.deleteServer);
router.post('/whatsapp-servers/:id/test', authMiddleware, whatsappServersController.testServer);
router.post('/whatsapp-servers/:id/activate', authMiddleware, whatsappServersController.toggleServer);
router.get('/whatsapp-servers/:id/qr', authMiddleware, whatsappServersController.getBaileysQr);

// ========================
// WhatsApp Instances Routes (from Evolution API)
// ========================
router.get('/whatsapp-instances', authMiddleware, async (req, res) => {
    try {
        const instances = await evolutionClient.fetchInstances();

        // Também busca o estado de conexão
        let connectionState = null;
        try {
            connectionState = await evolutionClient.getConnectionState();
        } catch (e) {
            // Ignora erro se não conseguir buscar estado
        }

        res.json({
            instances,
            connectionState,
            total: instances.length,
            connected: instances.filter((i: any) => i.connectionStatus === 'open' || i.status === 'open').length,
        });
    } catch (error: any) {
        if (error.name === 'ApiNotConfiguredError') {
            res.json({ instances: [], total: 0, connected: 0, notConfigured: true });
        } else {
            console.error('Erro ao buscar instâncias:', error);
            res.status(500).json({ error: 'Erro ao buscar instâncias', details: error.message });
        }
    }
});

// ========================
// Groups Routes (requer API configurada)
// ========================
router.get('/groups', authMiddleware, configGuardMiddleware, groupsController.listGroups);
router.post('/groups/sync', authMiddleware, configGuardMiddleware, groupsController.syncGroups);
router.patch('/groups/:id', authMiddleware, configGuardMiddleware, groupsController.updateGroup);
router.get('/groups/stats', authMiddleware, groupsController.getGroupStats);

// ========================
// Campaigns Routes
// ========================
router.get('/campaigns', authMiddleware, campaignsController.listCampaigns);
router.post('/campaigns', authMiddleware, configGuardMiddleware, campaignsController.createCampaign);
router.get('/campaigns/stats', authMiddleware, campaignsController.getCampaignStats);
router.get('/campaigns/:id', authMiddleware, campaignsController.getCampaign);
router.post('/campaigns/:id/start', authMiddleware, configGuardMiddleware, campaignsController.startCampaign);
router.post('/campaigns/:id/pause', authMiddleware, campaignsController.pauseCampaign);
router.delete('/campaigns/:id', authMiddleware, campaignsController.deleteCampaign);

// ========================
// Logs Routes
// ========================
router.get('/logs', authMiddleware, campaignsController.getLogs);

// ========================
// Launches Routes
// ========================
router.get('/launches', authMiddleware, launchController.list);
router.post('/launches', authMiddleware, launchController.create);
router.post('/launches/magic-generate', authMiddleware, launchController.generateMagicLaunch);
router.get('/launches/:id', authMiddleware, launchController.get);
router.put('/launches/:id', authMiddleware, launchController.update);
router.delete('/launches/:id', authMiddleware, launchController.remove);
router.get('/launches/:id/stats', authMiddleware, launchController.getStats);

// ========================
// Global Analytics Dashboard
// ========================
router.get('/analytics/dashboard', authMiddleware, analyticsController.getDashboardAnalytics);

// Launch Groups
router.get('/launches/:id/groups', authMiddleware, launchGroupsController.list);
router.post('/launches/:id/groups', authMiddleware, configGuardMiddleware, launchGroupsController.createBatch);
router.post('/launches/:id/groups/link', authMiddleware, launchGroupsController.linkExisting);
router.post('/launches/:id/groups/sync', authMiddleware, configGuardMiddleware, launchGroupsController.sync);
router.get('/launches/:id/groups/queue', authMiddleware, launchGroupsController.getQueue);
router.post('/launches/:id/groups/queue/:queueId/retry', authMiddleware, launchGroupsController.retryQueueItem);
router.patch('/launches/:id/groups/:groupId', authMiddleware, launchGroupsController.update);
router.delete('/launches/:id/groups/:groupId', authMiddleware, launchGroupsController.remove);

// Launch Leads
router.get('/launches/:id/leads', authMiddleware, launchLeadsController.list);
router.get('/launches/:id/leads/stats', authMiddleware, launchLeadsController.getStats);
router.get('/launches/:id/leads/export', authMiddleware, launchLeadsController.exportCSV);
router.get('/launches/:id/leads/:leadId', authMiddleware, launchLeadsController.get);
router.patch('/launches/:id/leads/:leadId', authMiddleware, launchLeadsController.update);
router.post('/launches/:id/leads/:leadId/block', authMiddleware, launchLeadsController.block);
router.delete('/launches/:id/leads/:leadId/groups/:groupId', authMiddleware, launchLeadsController.removeFromGroup);
router.delete('/launches/:id/leads/:leadId/groups', authMiddleware, launchLeadsController.removeFromAll);
router.post('/launches/:id/leads/send-private', authMiddleware, configGuardMiddleware, launchLeadsController.sendPrivateToAll);

// Launch Actions
router.get('/launches/:id/actions', authMiddleware, launchActionsController.list);
router.post('/launches/:id/actions', authMiddleware, launchActionsController.create);
router.post('/launches/:id/actions/:actionId/cancel', authMiddleware, launchActionsController.cancel);
router.post('/launches/:id/actions/:actionId/execute', authMiddleware, configGuardMiddleware, launchActionsController.executeNow);

// Launch Messages
router.get('/launches/:id/messages', authMiddleware, launchMessagesController.list);
router.post('/launches/:id/messages', authMiddleware, launchMessagesController.create);
router.post('/launches/:id/messages/:messageId/send', authMiddleware, configGuardMiddleware, launchMessagesController.sendNow);
router.post('/launches/:id/messages/:messageId/test', authMiddleware, configGuardMiddleware, launchMessagesController.sendTest);
router.get('/launches/:id/messages/:messageId/logs', authMiddleware, launchMessagesController.getLogs);
router.delete('/launches/:id/messages/:messageId', authMiddleware, launchMessagesController.remove);

// Private Messages (para leads no privado)
import * as privateMessagesController from '../controllers/private-messages.controller';

router.get('/launches/:id/private-messages', authMiddleware, privateMessagesController.list);
router.post('/launches/:id/private-messages', authMiddleware, privateMessagesController.create);
router.post('/launches/:id/private-messages/:msgId/send', authMiddleware, configGuardMiddleware, privateMessagesController.sendNow);
router.get('/launches/:id/private-messages/:msgId/logs', authMiddleware, privateMessagesController.getLogs);
router.delete('/launches/:id/private-messages/:msgId', authMiddleware, privateMessagesController.remove);

// Launch Webhooks (saída)
router.get('/launches/:id/webhooks', authMiddleware, launchWebhooksController.list);
router.post('/launches/:id/webhooks', authMiddleware, launchWebhooksController.create);
router.patch('/launches/:id/webhooks/:webhookId', authMiddleware, launchWebhooksController.update);
router.delete('/launches/:id/webhooks/:webhookId', authMiddleware, launchWebhooksController.remove);
router.post('/launches/:id/webhooks/:webhookId/test', authMiddleware, launchWebhooksController.test);
router.get('/launches/:id/webhooks/:webhookId/logs', authMiddleware, launchWebhooksController.getLogs);

// ========================
// Lead Messages (IA)
// ========================
import * as leadMessagesController from '../controllers/lead-messages.controller';

router.get('/launches/:id/inbox', authMiddleware, leadMessagesController.list);
router.get('/launches/:id/inbox/stats', authMiddleware, leadMessagesController.getStats);
router.post('/launches/:id/inbox/:messageId/approve', authMiddleware, leadMessagesController.approve);
router.post('/launches/:id/inbox/:messageId/reject', authMiddleware, leadMessagesController.reject);
router.post('/launches/:id/inbox/:messageId/ignore', authMiddleware, leadMessagesController.ignore);
router.post('/launches/:id/inbox/:messageId/regenerate', authMiddleware, leadMessagesController.regenerate);

// Config de IA por lançamento (prompt, autoReply)
router.get('/launches/:id/ai-config', authMiddleware, leadMessagesController.getLaunchAIConfig);
router.put('/launches/:id/ai-config', authMiddleware, leadMessagesController.updateLaunchAIConfig);

// ========================
// Config Global de IA (admin only)
// ========================
router.get('/ai-config', authMiddleware, requireMaster(), leadMessagesController.getAIConfig);
router.put('/ai-config', authMiddleware, requireMaster(), leadMessagesController.updateAIConfig);

// ========================
// AI Credits
// ========================
router.get('/ai-credits/balance', authMiddleware, aiCreditsController.getBalance);
router.get('/ai-credits/history', authMiddleware, aiCreditsController.getHistory);
router.get('/ai-credits/packages', authMiddleware, aiCreditsController.getPackages);
router.post('/ai-credits/purchase', authMiddleware, aiCreditsController.purchaseCredits);
router.post('/ai-credits/capture', authMiddleware, aiCreditsController.capturePurchase);

// ========================
// Webhook Global (Evolution API)
// ========================
router.get('/webhooks/config', authMiddleware, requireMaster(), webhookController.getConfig);
router.post('/webhooks/config/regenerate', authMiddleware, requireMaster(), webhookController.regenerateToken);
router.post('/webhooks/config/toggle', authMiddleware, requireMaster(), webhookController.toggle);
router.get('/webhooks/logs', authMiddleware, requireMaster(), webhookController.getLogs);

// Endpoint público para receber webhooks da Evolution
router.post('/webhooks/evolution', webhookController.handleEvolution);

// ========================
// Página Pública de Redirecionamento
// ========================
router.get('/l/:slug', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        // Buscar lançamento
        const launch = await prisma.launch.findUnique({
            where: { slug },
            include: {
                groups: {
                    where: { isReceiving: true },
                    orderBy: { memberCount: 'asc' },
                },
            },
        });

        if (!launch || launch.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Lançamento não encontrado' });
        }

        // Registrar clique
        const click = await prisma.launchClick.create({
            data: {
                launchId: launch.id,
                ip: req.ip || req.headers['x-forwarded-for']?.toString() || null,
                userAgent: req.headers['user-agent'] || null,
                referer: req.headers['referer'] || null,
                utmSource: req.query.utm_source?.toString() || null,
                utmMedium: req.query.utm_medium?.toString() || null,
                utmCampaign: req.query.utm_campaign?.toString() || null,
            },
        });

        // Encontrar próximo grupo com vagas
        const availableGroup = launch.groups.find(
            (g) => g.memberCount < launch.memberLimit
        );

        if (!availableGroup) {
            // Todos os grupos cheios
            return res.json({
                status: 'full',
                message: launch.fullPageMessage || 'Todos os grupos estão cheios no momento.',
            });
        }

        // Buscar link de convite
        let redirectUrl = availableGroup.inviteLink;

        if (!redirectUrl) {
            // Tentar buscar link atualizado
            try {
                redirectUrl = await evolutionClient.getGroupInviteLink(availableGroup.remoteJid);
                if (redirectUrl) {
                    await prisma.launchGroup.update({
                        where: { id: availableGroup.id },
                        data: { inviteLink: redirectUrl },
                    });
                }
            } catch {
                // Ignorar erro
            }
        }

        if (!redirectUrl) {
            return res.status(500).json({ error: 'Link do grupo não disponível' });
        }

        // Atualizar clique com URL
        await prisma.launchClick.update({
            where: { id: click.id },
            data: { redirectUrl },
        });

        // Retornar dados para o frontend construir a página
        res.json({
            status: 'ok',
            redirectUrl,
            linkType: launch.linkType,
            tracking: {
                metaPixelEnabled: launch.metaPixelEnabled,
                metaPixelId: launch.metaPixelId,
                metaPixelEvents: launch.metaPixelEvents ? JSON.parse(launch.metaPixelEvents) : null,
                gtmEnabled: launch.gtmEnabled,
                gtmId: launch.gtmId,
            },
            launch: {
                name: launch.name,
                description: launch.description,
            },
        });
    } catch (error) {
        console.error('[Redirect] Erro:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========================
// Status Route (para health check)
// ========================
router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
        
        console.log('[Status Debug] Config encontrada:', {
            id: config?.id,
            isConfigured: config?.isConfigured,
            hasUrl: !!config?.evolutionUrl,
            hasKey: !!config?.evolutionKey
        });

        let apiStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';

        if (config?.isConfigured) {
            try {
                const isConnected = await evolutionClient.isConnected();
                apiStatus = isConnected ? 'connected' : 'disconnected';
                console.log('[Status Debug] Resultado isConnected:', isConnected);
            } catch (err: any) {
                console.error('[Status Debug] Erro ao verificar isConnected:', err.message);
                apiStatus = 'disconnected';
            }
        } else {
            console.log('[Status Debug] Config marcada como não configurada (ou inexistente)');
        }

        res.json({
            api: apiStatus,
            worker: isWorkerRunning() ? 'running' : 'stopped',
            configured: config?.isConfigured || false,
        });
    } catch (error: any) {
        console.error('[Status Debug] Erro fatal na rota /status:', error.message);
        res.status(500).json({ error: 'Erro ao verificar status' });
    }
});

export default router;
