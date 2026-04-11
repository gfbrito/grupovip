import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { AppConfig } from '@prisma/client';

interface EvolutionGroup {
    id: string;
    subject: string;
    size: number;
    creation: number;
    owner: string;
    desc: string;
    restrict: boolean;
    announce: boolean;
}

interface ConnectionState {
    state: 'open' | 'close' | 'connecting';
    statusReason?: number;
}

export class ApiNotConfiguredError extends Error {
    constructor() {
        super('API não configurada');
        this.name = 'ApiNotConfiguredError';
    }
}

class EvolutionClient {
    private config: AppConfig | null = null;
    private configLoadedAt: number = 0;
    private readonly CACHE_TTL = 30000; // 30 segundos

    /**
     * Recarrega config do banco com cache de 30s
     */
    private async getConfig(): Promise<AppConfig> {
        const now = Date.now();

        if (this.config && now - this.configLoadedAt < this.CACHE_TTL) {
            return this.config;
        }

        this.config = await prisma.appConfig.findUnique({ where: { id: 1 } });

        if (!this.config) {
            this.config = await prisma.appConfig.findFirst();
        }

        // Se não tiver a flag mas tiver os dados, consideramos configurado (fail-safe)
        const actuallyConfigured = this.config?.isConfigured || (!!this.config?.evolutionUrl && !!this.config?.evolutionKey);

        if (!this.config || !actuallyConfigured) {
            throw new ApiNotConfiguredError();
        }

        this.configLoadedAt = now;
        return this.config;
    }

    /**
     * Cria instância do axios com credenciais atuais
     */
    private async createClient(): Promise<{ client: AxiosInstance; config: AppConfig }> {
        const config = await this.getConfig();

        if (!config.evolutionUrl || !config.evolutionKey) {
            throw new ApiNotConfiguredError();
        }

        let url = (config.evolutionUrl || '').trim().replace(/\/+$/, '');
        
        // Fail-safe: se o usuário colou a URL terminando em /instance, removemos para evitar duplicidade
        if (url.endsWith('/instance')) {
            url = url.replace(/\/instance$/, '');
        }

        const client = axios.create({
            baseURL: url,
            headers: {
                apikey: config.evolutionKey,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        return { client, config };
    }

    /**
     * Invalida cache forçando reload na próxima chamada
     */
    public invalidateCache(): void {
        this.config = null;
        this.configLoadedAt = 0;
    }

    /**
     * Retorna estado da conexão da instância
     */
    async getConnectionState(): Promise<ConnectionState> {
        const { client, config } = await this.createClient();

        const response = await client.get(`/instance/connectionState/${config.instanceName}`);

        return {
            state: response.data?.instance?.state || response.data?.state || 'close',
            statusReason: response.data?.instance?.statusReason,
        };
    }

    /**
     * Busca todas as instâncias do Evolution API
     */
    async fetchInstances(): Promise<any[]> {
        const { client } = await this.createClient();

        try {
            const response = await client.get('/instance/fetchInstances');

            if (Array.isArray(response.data)) {
                return response.data.map((instance: any) => ({
                    name: instance.instance?.instanceName || instance.name || instance.instanceName,
                    status: instance.instance?.status || instance.status || 'unknown',
                    owner: instance.instance?.owner || instance.owner,
                    profileName: instance.instance?.profileName || instance.profileName,
                    profilePicUrl: instance.instance?.profilePicUrl || instance.profilePicUrl,
                    number: instance.instance?.wuid?.replace('@s.whatsapp.net', '') ||
                        instance.wuid?.replace('@s.whatsapp.net', '') ||
                        instance.owner?.replace('@s.whatsapp.net', ''),
                    connectionStatus: instance.instance?.connectionStatus || instance.connectionStatus || 'unknown',
                }));
            }

            return [];
        } catch (error: any) {
            console.log('[Evolution] Erro ao buscar instâncias:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Busca todos os grupos da instância
     * Tenta diferentes endpoints dependendo da versão da Evolution API
     */
    async fetchGroups(): Promise<EvolutionGroup[]> {
        const { client, config } = await this.createClient();

        // Lista de endpoints para tentar (diferentes versões da API)
        const endpoints = [
            `/group/fetchAllGroups/${config.instanceName}`,
            `/group/fetchAllGroups/${config.instanceName}?getParticipants=false`,
            `/chat/findChats/${config.instanceName}`,
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`[Evolution] Tentando endpoint: ${endpoint}`);
                const response = await client.get(endpoint);

                // Parsear resposta dependendo do formato
                let groups: EvolutionGroup[] = [];

                if (Array.isArray(response.data)) {
                    // Formato array direto
                    groups = response.data
                        .filter((item: any) => item.id?.includes('@g.us') || item.remoteJid?.includes('@g.us'))
                        .map((item: any) => ({
                            id: item.id || item.remoteJid,
                            subject: item.subject || item.name || item.pushName || 'Grupo sem nome',
                            size: item.size || item.participants?.length || 0,
                            creation: item.creation || 0,
                            owner: item.owner || '',
                            desc: item.desc || item.description || '',
                            restrict: item.restrict || false,
                            announce: item.announce || false,
                        }));
                } else if (response.data?.groups && Array.isArray(response.data.groups)) {
                    groups = response.data.groups;
                } else if (response.data && typeof response.data === 'object') {
                    // Tentar extrair de objeto
                    const values = Object.values(response.data);
                    if (values.length > 0 && Array.isArray(values[0])) {
                        groups = (values[0] as any[])
                            .filter((item: any) => item.id?.includes('@g.us'))
                            .map((item: any) => ({
                                id: item.id,
                                subject: item.subject || item.name || 'Grupo sem nome',
                                size: item.size || 0,
                                creation: item.creation || 0,
                                owner: item.owner || '',
                                desc: item.desc || '',
                                restrict: item.restrict || false,
                                announce: item.announce || false,
                            }));
                    }
                }

                if (groups.length > 0) {
                    console.log(`[Evolution] Encontrados ${groups.length} grupos via ${endpoint}`);
                    return groups;
                }
            } catch (error: any) {
                console.log(`[Evolution] Endpoint ${endpoint} falhou:`, error.response?.data || error.message);
                // Continua para o próximo endpoint
            }
        }

        console.log('[Evolution] Nenhum endpoint retornou grupos');
        return [];
    }

    /**
     * Envia mensagem de texto para um grupo
     */
    async sendMessage(groupJid: string, text: string): Promise<void> {
        const { client, config } = await this.createClient();

        await client.post(`/message/sendText/${config.instanceName}`, {
            number: groupJid,
            text: text,
        });
    }

    /**
     * Envia mensagem com mídia
     */
    async sendMediaMessage(
        groupJid: string,
        type: 'image' | 'video' | 'document' | 'audio',
        mediaUrl: string,
        caption?: string
    ): Promise<void> {
        const { client, config } = await this.createClient();

        const endpoint = type === 'image' ? 'sendImage' :
            type === 'video' ? 'sendVideo' :
                type === 'document' ? 'sendDocument' : 'sendAudio';

        await client.post(`/message/${endpoint}/${config.instanceName}`, {
            number: groupJid,
            mediaUrl,
            caption: caption || '',
        });
    }

    /**
     * Cria um novo grupo
     */
    async createGroup(
        name: string,
        description?: string,
        participants?: string[]
    ): Promise<{ id: string; inviteLink?: string }> {
        const { client, config } = await this.createClient();

        const payload: any = {
            subject: name,
            description: description || '',
        };

        if (participants && participants.length > 0) {
            payload.participants = participants;
        }

        const response = await client.post(`/group/create/${config.instanceName}`, payload);

        const groupId = response.data?.id || response.data?.groupId || response.data?.jid;

        // Tentar buscar link de convite
        let inviteLink: string | undefined;
        try {
            const linkResponse = await client.get(
                `/group/inviteCode/${config.instanceName}?groupJid=${groupId}`
            );
            inviteLink = linkResponse.data?.inviteUrl || linkResponse.data?.code
                ? `https://chat.whatsapp.com/${linkResponse.data.code}`
                : undefined;
        } catch {
            // Ignorar erro se não conseguir buscar link
        }

        return { id: groupId, inviteLink };
    }

    /**
     * Busca participantes de um grupo
     * Retorna array de objetos com id e phoneNumber quando disponível
     */
    async getGroupParticipants(groupJid: string): Promise<any[]> {
        const { client, config } = await this.createClient();

        try {
            const response = await client.get(
                `/group/participants/${config.instanceName}?groupJid=${groupJid}`
            );

            let participants: any[] = [];

            if (Array.isArray(response.data)) {
                participants = response.data;
            } else if (response.data?.participants) {
                participants = response.data.participants;
            }

            // Retorna objetos completos para preservar phoneNumber
            return participants;
        } catch (error) {
            console.log(`[Evolution] Erro ao buscar participantes:`, error);
            return [];
        }
    }

    /**
     * Atualiza configurações do grupo
     */
    async updateGroupSettings(
        groupJid: string,
        settings: {
            name?: string;
            description?: string;
            messagesAdminsOnly?: boolean;
        }
    ): Promise<void> {
        const { client, config } = await this.createClient();

        if (settings.name) {
            await client.post(`/group/updateSubject/${config.instanceName}`, {
                groupJid,
                subject: settings.name,
            });
        }

        if (settings.description !== undefined) {
            await client.post(`/group/updateDescription/${config.instanceName}`, {
                groupJid,
                description: settings.description,
            });
        }

        if (settings.messagesAdminsOnly !== undefined) {
            await client.post(`/group/updateSetting/${config.instanceName}`, {
                groupJid,
                action: settings.messagesAdminsOnly ? 'announcement' : 'not_announcement',
            });
        }
    }

    /**
     * Atualiza foto do grupo
     */
    async updateGroupPhoto(groupJid: string, imageUrl: string): Promise<void> {
        const { client, config } = await this.createClient();

        await client.post(`/group/updateGroupPicture/${config.instanceName}`, {
            groupJid,
            image: imageUrl,
        });
    }

    /**
     * Busca link de convite do grupo
     */
    async getGroupInviteLink(groupJid: string): Promise<string | null> {
        const { client, config } = await this.createClient();

        try {
            const response = await client.get(
                `/group/inviteCode/${config.instanceName}?groupJid=${groupJid}`
            );

            if (response.data?.inviteUrl) {
                return response.data.inviteUrl;
            }

            if (response.data?.code) {
                return `https://chat.whatsapp.com/${response.data.code}`;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Cria uma nova instância na Evolution API
     */
    async createInstance(instanceName: string): Promise<any> {
        try {
            const { client } = await this.createClient();
            console.log(`[Evolution] Tentando criar instância: ${instanceName}`);
            
            const response = await client.post('/instance/create', {
                instanceName,
                token: '', 
                number: '',
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS', // Obrigatório em algumas versões v2
            });

            console.log(`[Evolution] Instância criada remotamente com sucesso`);
            return response.data;
        } catch (error: any) {
            console.error('[Evolution] Erro detalhado na criação remota:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Verifica se a API está configurada e conectada
     */
    async isConnected(): Promise<boolean> {
        try {
            const { client } = await this.createClient();
            // Usamos /instance/all como teste de saúde global pois é mais compatível
            // em diferentes versões da Evolution API para verificar infraestrutura
            const response = await client.get('/instance/all');
            return response.status === 200;
        } catch {
            return false;
        }
    }
}

// Exporta instância singleton
export const evolutionClient = new EvolutionClient();

