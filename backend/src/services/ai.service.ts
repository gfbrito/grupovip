import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ==================== INTERFACES ====================

export interface AIContext {
    launchName: string;
    groupName?: string;
    leadName?: string;
    systemPrompt?: string;
    recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
    suggestion: string;
    confidence: number;
    category: 'DUVIDA' | 'OBJECAO' | 'INTERESSE' | 'SAUDACAO' | 'OUTRO';
}

export interface MagicLaunchResponse {
    launchName: string;
    description: string;
    groups: Array<{ name: string; description: string }>;
    messages: Array<{ day: number; content: string }>;
}

export interface AIProvider {
    generateResponse(message: string, context: AIContext): Promise<AIResponse>;
    generateLaunch(description: string, eventDate?: string): Promise<MagicLaunchResponse>;
}

// ==================== OPENAI PROVIDER ====================

export class OpenAIProvider implements AIProvider {
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o-mini') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async generateResponse(message: string, context: AIContext): Promise<AIResponse> {
        const systemPrompt = context.systemPrompt || this.getDefaultPrompt(context);

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...(context.recentMessages || []),
                { role: 'user', content: message },
            ],
            functions: [{
                name: 'respond_to_lead',
                description: 'Gera uma resposta para o lead',
                parameters: {
                    type: 'object',
                    properties: {
                        suggestion: { type: 'string', description: 'Texto da resposta sugerida' },
                        confidence: { type: 'number', description: 'Nível de confiança de 0 a 1' },
                        category: {
                            type: 'string',
                            enum: ['DUVIDA', 'OBJECAO', 'INTERESSE', 'SAUDACAO', 'OUTRO'],
                            description: 'Categoria da mensagem do lead'
                        },
                    },
                    required: ['suggestion', 'confidence', 'category'],
                },
            }],
            function_call: { name: 'respond_to_lead' },
            temperature: 0.7,
        });

        const functionCall = response.choices[0].message.function_call;
        if (!functionCall?.arguments) {
            throw new Error('OpenAI não retornou resposta válida');
        }

        return JSON.parse(functionCall.arguments) as AIResponse;
    }

    async generateLaunch(description: string, eventDate?: string): Promise<MagicLaunchResponse> {
        const systemPrompt = `Você é um copywriter e estrategista mestre de lançamentos em grupos de WhatsApp.
Crie um lançamento completo baseado no produto/nicho fornecido.
${eventDate ? `- O evento principal/carrinho abre na data: ${eventDate}. Posicione a comunicação baseada/focada nisso.` : ''}
- Dê um nome épico ao lançamento.
- Crie uma descrição persuasiva.
- Crie nomes para 3 grupos com emojis.
- Escreva 3 mensagens de aquecimento para ser enviadas no grupo (D0 - boas-vindas, D1 - antecipação, D2 - oferta).
Retorne APENAS um JSON válido seguindo os tipos requeridos.`;

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Crie um lançamento para o seguinte projeto:\n\n${description}` },
            ],
            functions: [{
                name: 'generate_launch',
                description: 'Gera a estrutura de um lançamento',
                parameters: {
                    type: 'object',
                    properties: {
                        launchName: { type: 'string', description: 'Nome atrativo para o lançamento' },
                        description: { type: 'string', description: 'Descrição da estratégia do lançamento' },
                        groups: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' }
                                },
                                required: ['name', 'description']
                            }
                        },
                        messages: {
                            type: 'array',
                            description: 'Dias: 0 para envio imediato (boas vindas), 1 para o dia seguinte, etc.',
                            items: {
                                type: 'object',
                                properties: {
                                    day: { type: 'number' },
                                    content: { type: 'string' }
                                },
                                required: ['day', 'content']
                            }
                        }
                    },
                    required: ['launchName', 'description', 'groups', 'messages'],
                },
            }],
            function_call: { name: 'generate_launch' },
            temperature: 0.8,
        });

        const functionCall = response.choices[0].message.function_call;
        if (!functionCall?.arguments) {
            throw new Error('OpenAI não retornou estrutura de lançamento válida');
        }

        return JSON.parse(functionCall.arguments) as MagicLaunchResponse;
    }

    private getDefaultPrompt(context: AIContext): string {
        return `Você é um assistente de vendas para o lançamento "${context.launchName}".
Seu objetivo é responder leads de forma amigável, profissional e persuasiva.

Regras:
- Responda de forma curta e direta (máximo 2-3 frases)
- Use linguagem informal mas educada
- Identifique se é uma dúvida, objeção, interesse ou saudação
- Não prometa coisas que não sabe
- Use emojis moderadamente

${context.groupName ? `Grupo: ${context.groupName}` : ''}
${context.leadName ? `Lead: ${context.leadName}` : ''}`;
    }
}

// ==================== GEMINI PROVIDER ====================

export class GeminiProvider implements AIProvider {
    private client: GoogleGenerativeAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = model;
    }

    async generateResponse(message: string, context: AIContext): Promise<AIResponse> {
        const systemPrompt = context.systemPrompt || this.getDefaultPrompt(context);

        const model = this.client.getGenerativeModel({ model: this.model });

        const prompt = `${systemPrompt}

Mensagem do lead: "${message}"

Responda em formato JSON com:
- suggestion: texto da resposta
- confidence: número de 0 a 1
- category: DUVIDA, OBJECAO, INTERESSE, SAUDACAO ou OUTRO`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extrair JSON da resposta
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Gemini não retornou JSON válido');
        }

        return JSON.parse(jsonMatch[0]) as AIResponse;
    }

    async generateLaunch(description: string, eventDate?: string): Promise<MagicLaunchResponse> {
        const systemPrompt = `Você é um copywriter e estrategista mestre de lançamentos em grupos de WhatsApp.
Crie um lançamento completo baseado no produto/nicho fornecido.
${eventDate ? `- O evento principal ou abertura de carrinho será na data: ${eventDate}. Aloque a comunicação considerando essa data.` : ''}
- Dê um nome épico ao lançamento.
- Crie uma descrição persuasiva.
- Sugira 3 grupos (nomes e descrições).
- Escreva 3 mensagens estratégicas (D0, D1, D2).

Responda EXATAMENTE em formato JSON com a estrutura:
{
  "launchName": "string",
  "description": "string",
  "groups": [{"name": "string", "description": "string"}],
  "messages": [{"day": 0, "content": "string"}]
}`;
        const model = this.client.getGenerativeModel({ model: this.model });
        
        const prompt = `${systemPrompt}\n\nProduto/Projeto: "${description}"`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extrair JSON da resposta
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Gemini não retornou JSON válido');
        }

        return JSON.parse(jsonMatch[0]) as MagicLaunchResponse;
    }

    private getDefaultPrompt(context: AIContext): string {
        return `Você é um assistente de vendas para o lançamento "${context.launchName}".
Responda de forma curta, amigável e persuasiva.
Identifique a categoria da mensagem (DUVIDA, OBJECAO, INTERESSE, SAUDACAO, OUTRO).
${context.groupName ? `Grupo: ${context.groupName}` : ''}
${context.leadName ? `Lead: ${context.leadName}` : ''}`;
    }
}

// ==================== FACTORY ====================

export function createAIProvider(
    provider: 'OPENAI' | 'GEMINI',
    apiKey: string,
    model?: string
): AIProvider {
    switch (provider) {
        case 'OPENAI':
            return new OpenAIProvider(apiKey, model);
        case 'GEMINI':
            return new GeminiProvider(apiKey, model);
        default:
            throw new Error(`Provedor de IA não suportado: ${provider}`);
    }
}
