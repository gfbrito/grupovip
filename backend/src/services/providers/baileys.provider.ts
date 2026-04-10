import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    isJidGroup
} from '@whiskeysockets/baileys';
import pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

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

export class BaileysProvider implements IWhatsAppProvider {
    readonly providerName: string;
    readonly serverId: number;
    private instanceName: string;
    
    private sock: any = null;
    public qrCodeBase64: string | null = null;
    public connectionStatus: 'open' | 'close' | 'connecting' = 'close';
    public statusReason?: number;

    private webhookUrl?: string;
    private webhookToken?: string;
    private webhookEvents: string[] = [];

    // Cache local de grupos simples (evita requests pesados caso precise otimizar depois)
    private groupsCache: Record<string, any> = {};

    constructor(config: ServerConfig) {
        this.providerName = `Baileys:${config.name}`;
        this.serverId = config.id;
        this.instanceName = config.instanceName || `server-${config.id}`;
        
        // Iniciativa para ligar socket assíncronamente no boot
        this.initSocket().catch((err) => {
            console.error(`[Baileys:${this.instanceName}] Erro na inicialização:`, err.message);
        });
    }

    private async initSocket() {
        const sessionDir = path.join(process.cwd(), 'sessions', this.instanceName);
        if(!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }) as any,
            printQRInTerminal: false,
            syncFullHistory: false
        });

        // Eventos de Autenticação
        this.sock.ev.on('creds.update', saveCreds);

        // Eventos de Conexão
        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                import('qrcode').then(qrcode => {
                    qrcode.toDataURL(qr, (err, url) => {
                        if(!err) this.qrCodeBase64 = url;
                    });
                }).catch(() => {
                    console.error('[Baileys] Pacote qrcode não está instalado.');
                });
            }

            if (connection === 'close') {
                this.connectionStatus = 'close';
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                this.statusReason = statusCode;
                this.qrCodeBase64 = null;
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(`[Baileys:${this.instanceName}] Caiu. Reconectando...`);
                    setTimeout(() => this.initSocket(), 5000);
                } else {
                    console.log(`[Baileys:${this.instanceName}] Logged Out. Removendo sessão.`);
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                }
            } else if (connection === 'open') {
                console.log(`[Baileys:${this.instanceName}] Conectado com sucesso!`);
                this.connectionStatus = 'open';
                this.qrCodeBase64 = null;
                this.statusReason = undefined;
            }
        });

        // Eventos de Grupos e Participantes (Mapeando para o modelo do Webhook Evolution)
        this.sock.ev.on('groups.update', (groups: any) => {
            groups.forEach((g: any) => {
                this.groupsCache[g.id] = { ...this.groupsCache[g.id], ...g };
                this.fireWebhook('GROUPS_UPDATE', g);
            });
        });

        this.sock.ev.on('group-participants.update', (update: any) => {
            this.fireWebhook('GROUP_PARTICIPANTS_UPDATE', update);
        });

        // Evento de Mensagens
        this.sock.ev.on('messages.upsert', (m: any) => {
            const msgs = m.messages || [];
            msgs.forEach((msg: any) => {
                // Monta estrutura semelhante à Evolution API
                const payload = {
                    key: msg.key,
                    message: msg.message,
                    instance: this.instanceName
                };
                this.fireWebhook('MESSAGES_UPSERT', payload);
            });
        });
    }

    private fireWebhook(event: string, data: any) {
        if (!this.webhookUrl) return;
        if (this.webhookEvents.length > 0 && !this.webhookEvents.includes(event)) return;

        const payload = {
            event,
            instance: this.instanceName,
            data
        };

        axios.post(this.webhookUrl, payload, {
            headers: {
                'x-webhook-token': this.webhookToken || '',
                'x-webhook-event': event,
                'Content-Type': 'application/json'
            }
        }).catch(err => {
            console.error(`[Baileys:${this.instanceName}] Falha ao enviar Webhook ${event}:`, err.message);
        });
    }

    async isConnected(): Promise<boolean> {
        return this.connectionStatus === 'open';
    }

    async getConnectionState(): Promise<ConnectionState> {
        return {
            state: this.connectionStatus,
            statusReason: this.statusReason
        };
    }

    async fetchGroups(): Promise<WhatsAppGroup[]> {
        if (!this.isConnected() || !this.sock) return [];
        
        try {
            // No Baileys, 'sock.groupFetchAllParticipating()' retorna os grupos do usuário
            const groupsDict = await this.sock.groupFetchAllParticipating();
            const groups = Object.values(groupsDict).map((g: any) => ({
                id: g.id,
                subject: g.subject || 'Grupo sem nome',
                size: g.participants?.length || 0,
                creation: g.creation,
                owner: g.owner,
                desc: g.desc,
                restrict: g.restrict,
                announce: g.announce
            }));
            return groups;
        } catch (err: any) {
            console.error(`[Baileys:${this.instanceName}] fetchGroups falhou:`, err.message);
            return [];
        }
    }

    async createGroup(name: string, description?: string, participants?: string[]): Promise<CreateGroupResult> {
        if (!this.sock) throw new Error('Socket não está pronto');
        
        const safeParticipants = participants || [];
        const group = await this.sock.groupCreate(name, safeParticipants);
        
        if (description) {
            await this.sock.groupUpdateDescription(group.id, description);
        }

        let inviteLink: string | undefined;
        try {
            const code = await this.sock.groupInviteCode(group.id);
            if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
        } catch {}

        return { id: group.id, inviteLink };
    }

    async getGroupParticipants(groupJid: string): Promise<GroupParticipant[]> {
        if (!this.sock) return [];
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            return (metadata.participants || []).map((p: any) => ({
                id: p.id,
                phoneNumber: p.id.split('@')[0],
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
            }));
        } catch {
            return [];
        }
    }

    async getGroupInviteLink(groupJid: string): Promise<string | null> {
        if (!this.sock) return null;
        try {
            const code = await this.sock.groupInviteCode(groupJid);
            return code ? `https://chat.whatsapp.com/${code}` : null;
        } catch {
            return null;
        }
    }

    async updateGroupSettings(groupJid: string, settings: GroupSettings): Promise<void> {
        if (!this.sock) return;
        
        if (settings.name) {
            await this.sock.groupUpdateSubject(groupJid, settings.name);
        }
        if (settings.description !== undefined) {
            await this.sock.groupUpdateDescription(groupJid, settings.description);
        }
        if (settings.messagesAdminsOnly !== undefined) {
            await this.sock.groupSettingUpdate(groupJid, settings.messagesAdminsOnly ? 'announcement' : 'not_announcement');
        }
    }

    async updateGroupPhoto(groupJid: string, imageUrl: string): Promise<void> {
        if (!this.sock) return;
        try {
            // Pra atualizar via URL, Baileys precisa da imagem baixada
            // Sendo URL, o axios baixa.
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            // updateProfilePicture suporta Buffer no Baileys
            await this.sock.updateProfilePicture(groupJid, buffer);
        } catch (err: any) {
            console.error(`[Baileys:${this.instanceName}] updateGroupPhoto falhou:`, err.message);
        }
    }

    async sendMessage(groupJid: string, text: string): Promise<void> {
        if (!this.sock) return;
        await this.sock.sendMessage(groupJid, { text });
    }

    async sendMediaMessage(groupJid: string, type: MediaType, mediaUrl: string, caption?: string): Promise<void> {
        if (!this.sock) return;
        
        // Em Baileys, mídia pode ser um stream ou URL nativa suportada. URL direta costuma precisar de fetch manual.
        let msgPayload: any = {};
        
        if (type === 'image') msgPayload = { image: { url: mediaUrl }, caption: caption };
        else if (type === 'video') msgPayload = { video: { url: mediaUrl }, caption: caption };
        else if (type === 'audio') msgPayload = { audio: { url: mediaUrl }, mimetype: 'audio/mp4' };
        else if (type === 'document') {
            const fname = mediaUrl.split('/').pop() || 'documento';
            msgPayload = { document: { url: mediaUrl }, fileName: fname, mimetype: 'application/octet-stream', caption: caption };
        }

        await this.sock.sendMessage(groupJid, msgPayload);
    }

    async configureWebhook(webhookUrl: string, token: string, events: string[]): Promise<{ success: boolean; message?: string }> {
        this.webhookUrl = webhookUrl;
        this.webhookToken = token;
        this.webhookEvents = events || [];
        
        return { success: true, message: 'Webhook Interno Baileys Registrado com Sucesso' };
    }

    async getWebhookConfig(): Promise<{ url?: string; events?: string[] } | null> {
        if (!this.webhookUrl) return null;
        return {
            url: this.webhookUrl,
            events: this.webhookEvents
        };
    }
}
