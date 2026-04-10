import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import routes from './routes';
import { ensureAppConfig } from './config/database';
import { startQueueWorker } from './services/queue.worker';
import { startGroupCreationWorker } from './services/group-creation.worker';
import { startActionSchedulerWorker } from './services/action-scheduler.worker';
import { startLaunchMessageWorker } from './services/launch-message.worker';
import { startPrivateMessageWorker } from './services/private-message.worker';
import { initCreditsScheduler } from './services/credits-scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globais
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://grupos-frontend.gfgxr7.easypanel.host'
].filter(Boolean) as string[];

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
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
        // Garantir que AppConfig singleton existe
        await ensureAppConfig();
        console.log('✓ Banco de dados conectado');

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
        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`\n🚀 Backend rodando em http://localhost:${PORT}`);
            console.log(`   API: http://localhost:${PORT}/api`);
            console.log(`   Health: http://localhost:${PORT}/health\n`);
        });
    } catch (error) {
        console.error('Erro ao inicializar servidor:', error);
        process.exit(1);
    }
}

bootstrap();

