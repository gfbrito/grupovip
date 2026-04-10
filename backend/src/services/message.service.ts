import { Group } from '@prisma/client';

/**
 * Substitui variáveis no template da mensagem
 * Variáveis suportadas:
 * - {group_name} → Nome do grupo (ou nickname se definido)
 * - {date} → Data atual formatada (DD/MM/YYYY)
 * - {time} → Hora atual (HH:MM)
 */
export function replaceVariables(template: string, groupOrName: Group | string): string {
    const now = new Date();

    // Formatar data: DD/MM/YYYY
    const date = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    // Formatar hora: HH:MM
    const time = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Usar nickname se disponível, senão usar nome do grupo
    const groupName = typeof groupOrName === 'string'
        ? groupOrName
        : (groupOrName.nickname || groupOrName.name);

    return template
        .replace(/{group_name}/gi, groupName)
        .replace(/{date}/gi, date)
        .replace(/{time}/gi, time);
}

/**
 * Gera delay aleatório entre min e max milissegundos
 */
export function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Sleep assíncrono
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

