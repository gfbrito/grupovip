'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    title?: string;
    message: string;
    type: ToastType;
}

interface ToastOptions {
    type: ToastType;
    title?: string;
    message: string;
}

interface ToastContextType {
    toasts: Toast[];
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    remove: (id: string) => void;
    addToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToastInternal = useCallback((message: string, type: ToastType, title?: string) => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, message, type, title }]);

        // Auto-remove após 5 segundos
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const remove = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((message: string, title?: string) => addToastInternal(message, 'success', title), [addToastInternal]);
    const error = useCallback((message: string, title?: string) => addToastInternal(message, 'error', title), [addToastInternal]);
    const warning = useCallback((message: string, title?: string) => addToastInternal(message, 'warning', title), [addToastInternal]);
    const info = useCallback((message: string, title?: string) => addToastInternal(message, 'info', title), [addToastInternal]);

    const addToast = useCallback((options: ToastOptions) => {
        addToastInternal(options.message, options.type, options.title);
    }, [addToastInternal]);

    return (
        <ToastContext.Provider value={{ toasts, success, error, warning, info, remove, addToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={remove} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    if (toasts.length === 0) return null;

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const bgColors = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-amber-50 border-amber-200',
        info: 'bg-blue-50 border-blue-200',
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in ${bgColors[toast.type]}`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icons[toast.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                        {toast.title && (
                            <p className="text-sm font-semibold text-slate-900 mb-1">{toast.title}</p>
                        )}
                        <p className="text-sm text-slate-700 break-words">{toast.message}</p>
                    </div>
                    <button
                        onClick={() => onRemove(toast.id)}
                        className="text-slate-400 hover:text-slate-600 flex-shrink-0 -mr-1 -mt-1 p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
        </div>
    );
}
