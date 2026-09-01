import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';
import { ensurePostgresSchema } from './db/init.js';

const app = express();

app.set('trust proxy', true);

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});
  
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');

	await new Promise(resolve => setTimeout(resolve, 3000));

	logger.info('Exiting');
	process.exit();
});

app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN,
	credentials: true,
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({ 
	extended: true,
	limit: BodyLimit,
}));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

export async function startServer(port = process.env.PORT || 3005) {
	await ensurePostgresSchema();
	return new Promise((resolve, reject) => {
		const server = app.listen(port);
		server.once('error', reject);
		server.once('listening', () => {
			const address = server.address();
			const listeningPort = typeof address === 'object' && address ? address.port : port;
			logger.info(`API Server running on http://localhost:${listeningPort}`);
			resolve(server);
		});
	});
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
	startServer().catch((error) => {
		logger.error(`Falha ao iniciar API na porta ${process.env.PORT || 3005}:`, error);
		process.exit(1);
	});
}

export default app;
