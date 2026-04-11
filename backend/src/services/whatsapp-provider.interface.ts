/**
 * Interface comum para todos os provedores WhatsApp
 * (Baileys, Evolution API, WhatsApp Web.js)
 */

export interface ConnectionState {
    state: 'open' | 'close' | 'connecting';
    statusReason?: number;
}

export interface WhatsAppGroup {
    id: string;
    subject: string;
    size: number;
    creation?: number;
    owner?: string;
    desc?: string;
    restrict?: boolean;
    announce?: boolean;
}

export interface GroupParticipant {
    id: string;
    phoneNumber?: string;
    isAdmin?: boolean;
}

export interface GroupSettings {
    name?: string;
    description?: string;
    messagesAdminsOnly?: boolean;
}

export type MediaType = 'image' | 'video' | 'document' | 'audio';

export interface CreateGroupResult {
    id: string;
    inviteLink?: string;
}

/**
 * Interface que todos os clientes WhatsApp devem implementar
 */
export interface IWhatsAppProvider {
    /** Nome do provedor para logs */
    readonly providerName: string;

    /** ID do servidor no banco */
    readonly serverId: number;

    // ==================== Propriedades de Estado ====================

    /** QR Code atual em base64 (se disponível e não conectado) */
    qrCodeBase64: string | null;

    /** Status simplificado da conexão */
    readonly connectionStatus: 'open' | 'close' | 'connecting';

    // ==================== Conexão ====================

    /**
     * Verifica se está conectado
     */
    isConnected(): Promise<boolean>;

    /**
     * Retorna estado detalhado da conexão
     */
    getConnectionState(): Promise<ConnectionState>;

    // ==================== Grupos ====================

    /**
     * Busca todos os grupos
     */
    fetchGroups(): Promise<WhatsAppGroup[]>;

    /**
     * Cria um novo grupo
     */
    createGroup(
        name: string,
        description?: string,
        participants?: string[]
    ): Promise<CreateGroupResult>;

    /**
     * Busca participantes de um grupo
     */
    getGroupParticipants(groupJid: string): Promise<GroupParticipant[]>;

    /**
     * Obtém link de convite do grupo
     */
    getGroupInviteLink(groupJid: string): Promise<string | null>;

    /**
     * Atualiza configurações do grupo
     */
    updateGroupSettings(groupJid: string, settings: GroupSettings): Promise<void>;

    /**
     * Atualiza foto do grupo
     */
    updateGroupPhoto(groupJid: string, imageUrl: string): Promise<void>;

    // ==================== Mensagens ====================

    /**
     * Envia mensagem de texto
     */
    sendMessage(groupJid: string, text: string): Promise<void>;
    /**
     * Envia mensagem com mídia
     */
    sendMediaMessage(
        groupJid: string,
        type: MediaType,
        mediaUrl: string,
        caption?: string
    ): Promise<void>;

    // ==================== Webhook ====================

    /**
     * Configura o webhook no servidor para receber eventos
     * @param webhookUrl URL do nosso endpoint para receber webhooks
     * @param token Token de autenticação
     * @param events Lista de eventos para receber (ex: GROUP_PARTICIPANTS_UPDATE, messages.upsert)
     */
    configureWebhook(
        webhookUrl: string,
        token: string,
        events: string[]
    ): Promise<{ success: boolean; message?: string }>;

    /**
     * Busca configuração atual do webhook (se suportado)
     */
    getWebhookConfig?(): Promise<{ url?: string; events?: string[] } | null>;
}

/**
 * Tipo de provedor
 */
export type ProviderType = 'BAILEYS' | 'EVOLUTION' | 'WEBJS';

/**
 * Configuração de servidor do banco
 */
export interface ServerConfig {
    id: number;
    name: string;
    type: ProviderType;
    url: string;
    apiKey?: string | null;
    instanceName?: string | null;
    isActive: boolean;
    priority: number;
}
