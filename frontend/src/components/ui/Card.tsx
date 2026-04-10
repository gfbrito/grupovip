import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
}

function Card({ children, className = '' }: CardProps) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
            {children}
        </div>
    );
}

function CardHeader({ children, className = '' }: CardProps) {
    return (
        <div className={`px-6 py-4 border-b border-slate-100 ${className}`}>
            {children}
        </div>
    );
}

function CardBody({ children, className = '' }: CardProps) {
    return (
        <div className={`px-6 py-4 ${className}`}>
            {children}
        </div>
    );
}

function CardFooter({ children, className = '' }: CardProps) {
    return (
        <div className={`px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl ${className}`}>
            {children}
        </div>
    );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };
export default Card;
