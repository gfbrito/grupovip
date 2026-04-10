import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para tratamento de erros globais
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Se for erro de autenticação, redirecionar para login
        // Mas não redirecionar se já estiver em páginas de auth
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                const isAuthPage = path.includes('/login') || path.includes('/register');
                
                // Se o erro for no /auth/me, não redirecionamos aqui para evitar loops.
                // O hook useAuth já vai tratar o estado de deslogado.
                const isMeRequest = error.config?.url?.includes('/auth/me');

                if (!isAuthPage && !isMeRequest) {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
