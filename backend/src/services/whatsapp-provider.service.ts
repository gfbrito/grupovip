/**
 * Serviço de gerenciamento de provedores WhatsApp
 * Escolhe automaticamente o provedor ativo com maior prioridade
 * e faz failover automático em caso de erro
 */

import { prisma } from '../config/database';
import {
    IWhatsAppProvider,
    ProviderType,
    ServerConfig,
    ConnectionState,
    WhatsAppGroup,
    CreateGroupResult,
    GroupParticipant,
    GroupSettings,
    MediaType
} from './whatsapp-provider.interface';
import { EvolutionProvider } from './providers/evolution.provider';
import { BaileysProvider } from './providers/baileys.provider';
// import { WebjsProvider } from './providers/webjs.provider';

export class ProviderNotConfiguredError extends Error {
    constructor() {
        super('Nenhum servidor WhatsApp configurado e ativo');
        this.name = 'ProviderNotConfiguredError';
    }
}

export class AllProvidersFailedError extends Error {
    constructor(public readonly errors: Array<{ provider: string; error: string }>) {
        super('Todos os provedores falharam');
        this.name = 'AllProvidersFailedError';
    }
}

class WhatsAppProviderService {
    private providers: Map<number, IWhatsAppProvider> = new Map();
    private cachedServers: ServerConfig[] = [];
    private lastCacheTime: number = 0;
    private readonly CACHE_TTL = 30000; // 30 segundos

    /**
     * Recarrega lista de servidores ativos do banco
     */
    private async getActiveServers(): Promise<ServerConfig[]> {
        const now = Date.now();

        if (this.cachedServers.length > 0 && now - this.lastCacheTime < this.CACHE_TTL) {
            return this.cachedServers;
        }

        const servers = await prisma.whatsAppServer.findMany({
            where: { isActive: true },
            orderBy: { priority: 'asc' },
        });

        this.cachedServers = servers.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type as ProviderType,
            url: s.url,
            apiKey: s.apiKey,
            instanceName: s.instanceName,
            isActive: s.isActive,
            priority: s.priority,
        }));

        this.lastCacheTime = now;
        return this.cachedServers;
    }

    /**
     * Cria ou retorna instância do provider para um servidor
     */
    private getOrCreateProvider(server: ServerConfig): IWhatsAppProvider {
        if (this.providers.has(server.id)) {
            return this.providers.get(server.id)!;
        }

        let provider: IWhatsAppProvider;

        switch (server.type) {
            case 'EVOLUTION':
                provider = new EvolutionProvider(server);
                break;
            case 'BAILEYS':
                provider = new BaileysProvider(server);
                break;
            case 'WEBJS':
                // TODO: Implementar WebjsProvider
                throw new Error('Provedor Web.js ainda não implementado');
            default:
                throw new Error(`Tipo de provedor desconhecido: ${server.type}`);
        }

        this.providers.set(server.id, provider);
        return provider;
    }

    /**
     * Obtém um provider específico pelo ID do servidor
     */
    async getProviderById(serverId: number): Promise<IWhatsAppProvider> {
        const servers = await this.getActiveServers();
        const server = servers.find(s => s.id === serverId);
        
        if (!server) {
            // Verifica no banco se existe (pode estar inativo ou ser novo pra gerar QR)
            const dbServer = await prisma.whatsAppServer.findUnique({ where: { id: serverId } });
            if (!dbServer) throw new Error('Servidor não encontrado');
            return this.getOrCreateProvider(dbServer as ServerConfig);
        }

        return this.getOrCreateProvider(server);
    }

    /**
     * Obtém o provider ativo com maior prioridade
     */
    async getActiveProvider(): Promise<IWhatsAppProvider> {
        const servers = await this.getActiveServers();

        if (servers.length === 0) {
            // Fallback para AppConfig legado
            const legacyConfig = await prisma.appConfig.findUnique({ where: { id: 1 } });
            if (legacyConfig?.isConfigured && legacyConfig.evolutionUrl) {
                const legacyServer: ServerConfig = {
                    id: -1, // ID especial para legado
                    name: 'Evolution (Legado)',
                    type: 'EVOLUTION',
                    url: legacyConfig.evolutionUrl,
                    apiKey: legacyConfig.evolutionKey,
                    instanceName: legacyConfig.instanceName,
                    isActive: true,
                    priority: 999,
                };
                return this.getOrCreateProvider(legacyServer);
            }
            throw new ProviderNotConfiguredError();
        }

        return this.getOrCreateProvider(servers[0]);
    }

    /**
     * Executa uma operação com failover automático
     */
    async executeWithFailover<T>(
        operation: (provider: IWhatsAppProvider) => Promise<T>,
        operationName: string
    ): Promise<T> {
        const servers = await this.getActiveServers();
        const errors: Array<{ provider: string; error: string }> = [];

        // Se não há servidores, tenta config legada
        if (servers.length === 0) {
            const provider = await this.getActiveProvider();
            return operation(provider);
        }

        for (const server of servers) {
            try {
                const provider = this.getOrCreateProvider(server);
                console.log(`[WhatsAppProvider] Tentando ${operationName} via ${server.name} (${server.type})`);
                return await operation(provider);
            } catch (error: any) {
                console.error(`[WhatsAppProvider] Falha em ${server.name}:`, error.message);
                errors.push({ provider: server.name, error: error.message });
                // Continua para próximo servidor
            }
        }

        throw new AllProvidersFailedError(errors);
    }

    /**
     * Invalida cache forçando recarregamento
     */
    invalidateCache(): void {
        this.cachedServers = [];
        this.lastCacheTime = 0;
        this.providers.clear();
    }

    // ==================== Métodos de Conveniência ====================
    // Atalhos que usam failover automático

    async isConnected(): Promise<boolean> {
        return this.executeWithFailover(p => p.isConnected(), 'isConnected');
    }

    async getConnectionState(): Promise<ConnectionState> {
        return this.executeWithFailover(p => p.getConnectionState(), 'getConnectionState');
    }

    async fetchGroups(): Promise<WhatsAppGroup[]> {
        return this.executeWithFailover(p => p.fetchGroups(), 'fetchGroups');
    }

    async createGroup(name: string, description?: string, participants?: string[]): Promise<CreateGroupResult> {
        return this.executeWithFailover(p => p.createGroup(name, description, participants), 'createGroup');
    }

    async getGroupParticipants(groupJid: string): Promise<GroupParticipant[]> {
        return this.executeWithFailover(p => p.getGroupParticipants(groupJid), 'getGroupParticipants');
    }

    async getGroupInviteLink(groupJid: string): Promise<string | null> {
        return this.executeWithFailover(p => p.getGroupInviteLink(groupJid), 'getGroupInviteLink');
    }

    async updateGroupSettings(groupJid: string, settings: GroupSettings): Promise<void> {
        return this.executeWithFailover(p => p.updateGroupSettings(groupJid, settings), 'updateGroupSettings');
    }

    async updateGroupPhoto(groupJid: string, imageUrl: string): Promise<void> {
        return this.executeWithFailover(p => p.updateGroupPhoto(groupJid, imageUrl), 'updateGroupPhoto');
    }

    async sendMessage(groupJid: string, text: string): Promise<void> {
        return this.executeWithFailover(p => p.sendMessage(groupJid, text), 'sendMessage');
    }

    async sendMediaMessage(groupJid: string, type: MediaType, mediaUrl: string, caption?: string): Promise<void> {
        return this.executeWithFailover(p => p.sendMediaMessage(groupJid, type, mediaUrl, caption), 'sendMediaMessage');
    }
}

// Exporta instância singleton
export const whatsappProvider = new WhatsAppProviderService();
