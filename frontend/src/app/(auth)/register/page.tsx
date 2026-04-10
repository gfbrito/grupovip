'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Mail, Lock, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/contexts/ToastContext';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { register } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Nome é obrigatório';
        }

        if (!email.trim()) {
            newErrors.email = 'Email é obrigatório';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = 'Email inválido';
        }

        if (!password) {
            newErrors.password = 'Senha é obrigatória';
        } else if (password.length < 6) {
            newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'As senhas não coincidem';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        try {
            await register(email, password, name);
            toast.success('Conta criada com sucesso!');
            router.push('/settings');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 mb-4">
                        <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp Sender</h1>
                    <p className="text-slate-500 mt-1">Crie sua conta para começar</p>
                </div>

                <Card>
                    <Card.Body className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Nome"
                                type="text"
                                placeholder="Seu nome"
                                icon={<User className="w-5 h-5" />}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                error={errors.name}
                            />

                            <Input
                                label="Email"
                                type="email"
                                placeholder="seu@email.com"
                                icon={<Mail className="w-5 h-5" />}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                error={errors.email}
                            />

                            <Input
                                label="Senha"
                                type="password"
                                placeholder="••••••••"
                                icon={<Lock className="w-5 h-5" />}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                error={errors.password}
                            />

                            <Input
                                label="Confirmar Senha"
                                type="password"
                                placeholder="••••••••"
                                icon={<Lock className="w-5 h-5" />}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                error={errors.confirmPassword}
                            />

                            <Button type="submit" className="w-full" loading={loading}>
                                Criar Conta
                            </Button>
                        </form>
                    </Card.Body>
                    <Card.Footer className="text-center">
                        <p className="text-sm text-slate-600">
                            Já tem uma conta?{' '}
                            <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
                                Fazer login
                            </Link>
                        </p>
                    </Card.Footer>
                </Card>
            </div>
        </div>
    );
}
