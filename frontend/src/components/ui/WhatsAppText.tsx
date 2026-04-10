'use client';

import React from 'react';

interface WhatsAppTextProps {
    text: string;
    className?: string;
}

/**
 * Componente que renderiza texto com formatação estilo WhatsApp
 * Suporta: *negrito*, _itálico_, ~tachado~, ```código```
 */
export default function WhatsAppText({ text, className = '' }: WhatsAppTextProps) {
    const formatText = (input: string): React.ReactNode[] => {
        if (!input) return [];

        // Regex patterns para formatação WhatsApp
        const patterns = [
            // Código em bloco (``` ```)
            {
                regex: /```([\s\S]*?)```/g, render: (match: string, p1: string) => (
                    <code key={Math.random()} className="block bg-slate-100 text-slate-800 px-3 py-2 rounded-lg my-2 font-mono text-sm whitespace-pre-wrap">
                        {p1}
                    </code>
                )
            },
            // Código inline (` `)
            {
                regex: /`([^`]+)`/g, render: (match: string, p1: string) => (
                    <code key={Math.random()} className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-sm">
                        {p1}
                    </code>
                )
            },
            // Negrito (*texto*)
            {
                regex: /\*([^*]+)\*/g, render: (match: string, p1: string) => (
                    <strong key={Math.random()} className="font-bold">{p1}</strong>
                )
            },
            // Itálico (_texto_)
            {
                regex: /_([^_]+)_/g, render: (match: string, p1: string) => (
                    <em key={Math.random()} className="italic">{p1}</em>
                )
            },
            // Tachado (~texto~)
            {
                regex: /~([^~]+)~/g, render: (match: string, p1: string) => (
                    <span key={Math.random()} className="line-through">{p1}</span>
                )
            },
        ];

        let result: React.ReactNode[] = [input];

        // Aplicar cada padrão sequencialmente
        patterns.forEach(({ regex, render }) => {
            const newResult: React.ReactNode[] = [];

            result.forEach((segment) => {
                if (typeof segment !== 'string') {
                    newResult.push(segment);
                    return;
                }

                const parts: React.ReactNode[] = [];
                let lastIndex = 0;
                let match;

                // Resetar regex
                regex.lastIndex = 0;

                while ((match = regex.exec(segment)) !== null) {
                    // Adicionar texto antes do match
                    if (match.index > lastIndex) {
                        parts.push(segment.slice(lastIndex, match.index));
                    }

                    // Adicionar elemento formatado
                    parts.push(render(match[0], match[1]));

                    lastIndex = match.index + match[0].length;
                }

                // Adicionar texto restante
                if (lastIndex < segment.length) {
                    parts.push(segment.slice(lastIndex));
                }

                newResult.push(...(parts.length > 0 ? parts : [segment]));
            });

            result = newResult;
        });

        return result;
    };

    // Processar quebras de linha
    const lines = text.split('\n');

    return (
        <div className={`whitespace-pre-wrap ${className}`}>
            {lines.map((line, index) => (
                <React.Fragment key={index}>
                    {formatText(line)}
                    {index < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </div>
    );
}
