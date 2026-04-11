/**
 * Provider Evolution API
 * Implementa IWhatsAppProvider para Evolution API
 */

import axios, { AxiosInstance } from 'axios';
import {
    IWhatsAppProvider,
    ConnectionState,
    WhatsAppGroup,
    CreateGroupResult,
    GroupParticipant,
    GroupSettings,
    MediaType,
    ServerConfig
} from '../whatsapp-provider.interface';

export class EvolutionProvider implements IWhatsAppProvider {
    readonly providerName: string;
    readonly serverId: number;
    private client: AxiosInstance;
    private instanceName: string;

    private _qrCode: string | null = null;

    constructor(config: ServerConfig) {
        this.providerName = `Evolution:${config.name}`;
        this.serverId = config.id;
        this.instanceName = config.instanceName || '';

        this.client = axios.create({
            baseURL: config.url.replace(/\/+$/, ''),
            headers: {
                apikey: config.apiKey || '',
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }

    get qrCodeBase64(): string | null {
        // A Evolution API geralmente retorna o QR no connect ou via fetch
        // Por enquanto retornamos o cache se houver, o controller vai forçar a busca
        return this._qrCode;
    }

    set qrCodeBase64(value: string | null) {
        this._qrCode = value;
    }

    private _state: 'open' | 'close' | 'connecting' = 'close';

    get connectionStatus(): 'open' | 'close' | 'connecting' {
        return this._state;
    }

    async isConnected(): Promise<boolean> {
        try {
            const state = await this.getConnectionState();
            this._state = state.state;
            return state.state === 'open';
        } catch {
            this._state = 'close';
            return false;
        }
    }

    async getConnectionState(): Promise<ConnectionState> {
        const response = await this.client.get(`/instance/connectionState/${this.instanceName}`);
        return {
            state: response.data?.instance?.state || response.data?.state || 'close',
            statusReason: response.data?.instance?.statusReason,
        };
    }

    async fetchGroups(): Promise<WhatsAppGroup[]> {
        const endpoints = [
            `/group/fetchAllGroups/${this.instanceName}`,
            `/group/fetchAllGroups/${this.instanceName}?getParticipants=false`,
            `/chat/findChats/${this.instanceName}`,
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.client.get(endpoint);
                let groups: WhatsAppGroup[] = [];

                if (Array.isArray(response.data)) {
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
                }

                if (groups.length > 0) {
                    return groups;
                }
            } catch (error: any) {
                console.log(`[Evolution] Endpoint ${endpoint} falhou:`, error.message);
            }
        }

        return [];
    }

    async createGroup(name: string, description?: string, participants?: string[]): Promise<CreateGroupResult> {
        const payload: any = {
            subject: name,
            description: description || '',
        };

        if (participants && participants.length > 0) {
            payload.participants = participants;
        }

        const response = await this.client.post(`/group/create/${this.instanceName}`, payload);
        const groupId = response.data?.id || response.data?.groupId || response.data?.jid;

        // Tentar buscar link de convite
        let inviteLink: string | undefined;
        try {
            const linkResponse = await this.client.get(
                `/group/inviteCode/${this.instanceName}?groupJid=${groupId}`
            );
            inviteLink = linkResponse.data?.inviteUrl ||
                (linkResponse.data?.code ? `https://chat.whatsapp.com/${linkResponse.data.code}` : undefined);
        } catch {
            // Ignorar erro
        }

        return { id: groupId, inviteLink };
    }

    async getGroupParticipants(groupJid: string): Promise<GroupParticipant[]> {
        try {
            const response = await this.client.get(
                `/group/participants/${this.instanceName}?groupJid=${groupJid}`
            );

            let participants: any[] = [];
            if (Array.isArray(response.data)) {
                participants = response.data;
            } else if (response.data?.participants) {
                participants = response.data.participants;
            }

            return participants.map(p => ({
                id: p.id || p.jid,
                phoneNumber: p.phoneNumber,
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
            }));
        } catch {
            return [];
        }
    }

    async getGroupInviteLink(groupJid: string): Promise<string | null> {
        try {
            const response = await this.client.get(
                `/group/inviteCode/${this.instanceName}?groupJid=${groupJid}`
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

    async updateGroupSettings(groupJid: string, settings: GroupSettings): Promise<void> {
        if (settings.name) {
            await this.client.post(`/group/updateSubject/${this.instanceName}`, {
                groupJid,
                subject: settings.name,
            });
        }

        if (settings.description !== undefined) {
            await this.client.post(`/group/updateDescription/${this.instanceName}`, {
                groupJid,
                description: settings.description,
            });
        }

        if (settings.messagesAdminsOnly !== undefined) {
            await this.client.post(`/group/updateSetting/${this.instanceName}`, {
                groupJid,
                action: settings.messagesAdminsOnly ? 'announcement' : 'not_announcement',
            });
        }
    }

    async updateGroupPhoto(groupJid: string, imageUrl: string): Promise<void> {
        await this.client.post(`/group/updateGroupPicture/${this.instanceName}`, {
            groupJid,
            image: imageUrl,
        });
    }

    async sendMessage(groupJid: string, text: string): Promise<void> {
        await this.client.post(`/message/sendText/${this.instanceName}`, {
            number: groupJid,
            text: text,
        });
    }

    async sendMediaMessage(
        groupJid: string,
        type: MediaType,
        mediaUrl: string,
        caption?: string
    ): Promise<void> {
        const endpoint = type === 'image' ? 'sendImage' :
            type === 'video' ? 'sendVideo' :
                type === 'document' ? 'sendDocument' : 'sendAudio';

        await this.client.post(`/message/${endpoint}/${this.instanceName}`, {
            number: groupJid,
            mediaUrl,
            caption: caption || '',
        });
    }

    async configureWebhook(
        webhookUrl: string,
        token: string,
        events: string[]
    ): Promise<{ success: boolean; message?: string }> {
        try {
            // Evolution API usa endpoint /webhook/set/{instanceName}
            const response = await this.client.post(`/webhook/set/${this.instanceName}`, {
                enabled: true,
                url: webhookUrl,
                headers: {
                    'x-webhook-token': token,
                },
                events: events.length > 0 ? events : [
                    'GROUP_PARTICIPANTS_UPDATE',
                    'GROUPS_UPDATE',
                    'MESSAGES_UPSERT',
                ],
                webhookByEvents: false,
            });

            console.log(`[Evolution] Webhook configurado para ${this.instanceName}`);
            return { success: true, message: 'Webhook configurado com sucesso' };
        } catch (error: any) {
            console.error(`[Evolution] Erro ao configurar webhook:`, error.message);
            return { success: false, message: error.message };
        }
    }

    async getWebhookConfig(): Promise<{ url?: string; events?: string[] } | null> {
        try {
            const response = await this.client.get(`/webhook/find/${this.instanceName}`);
            return {
                url: response.data?.url,
                events: response.data?.events || [],
            };
        } catch {
            return null;
        }
    }
}
