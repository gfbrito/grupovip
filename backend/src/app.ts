import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import routes from './routes';
import { ensureAppConfig, ensurePlans } from './config/database';
import { startQueueWorker } from './services/queue.worker';
import { startGroupCreationWorker } from './services/group-creation.worker';
import { startActionSchedulerWorker } from './services/action-scheduler.worker';
import { startLaunchMessageWorker } from './services/launch-message.worker';
import { startPrivateMessageWorker } from './services/private-message.worker';
import { initCreditsScheduler } from './services/credits-scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy é necessário para cookies secure: true funcionarem atrás do Easypanel/Nginx
app.set('trust proxy', 1);

// Middlewares globais
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://grupos-frontend.gfgxr7.easypanel.host',
    'https://grupovip.gfbdigital.com.br'
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked for origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
app.use(express.json());
app.use(cookieParser());

// Rotas da API
app.use('/api', routes);

// Arquivos estáticos de Upload
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check básico
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Inicialização
async function bootstrap() {
    try {
        // Garantir que AppConfig singleton e Planos iniciais existem
        await ensureAppConfig();
        await ensurePlans();
        console.log('✓ Banco de dados conectado e planos sincronizados');

        // Iniciar workers
        startQueueWorker();
        console.log('✓ Worker de fila de campanhas iniciado');

        startGroupCreationWorker();
        console.log('✓ Worker de criação de grupos iniciado');

        startActionSchedulerWorker();
        console.log('✓ Worker de ações agendadas iniciado');

        startLaunchMessageWorker();
        console.log('✓ Worker de mensagens de lançamento iniciado');

        startPrivateMessageWorker();
        console.log('✓ Worker de envio de mensagens privadas iniciado');

        // Iniciar cron jobs
        initCreditsScheduler();
        console.log('✓ Scheduler de créditos de IA iniciado (Cron)');

        // Iniciar servidor
        const server = app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`\n🚀 Backend rodando na porta ${PORT}`);
            console.log(`   Health: /health\n`);
        });

        server.on('error', (error) => {
            console.error('❌ Erro no servidor Express:', error);
        });
    } catch (error) {
        console.error('Erro ao inicializar servidor:', error);
        process.exit(1);
    }
}

bootstrap();

