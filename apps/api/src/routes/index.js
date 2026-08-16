import { Router } from 'express';
import healthCheck from './health-check.js';
import authRouter from './auth.js';
import integratedAiRouter from './integrated-ai.js';
import googleDriveRouter from './google-drive.js';
import tasksRouter from './tasks.js';
import recordsRouter from './records.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/auth', authRouter);
    router.use('/tasks', tasksRouter);
    router.use('/records', recordsRouter);
    router.use('/integrated-ai', integratedAiRouter);
    router.use('/google-drive', googleDriveRouter);

    return router;
};
