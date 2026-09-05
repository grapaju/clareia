import { Router } from 'express';
import { ZodError } from 'zod';
import { parseFinanceEvent, verifyFinanceWebhook } from '../utils/finance-integration.js';
import { receiveFinanceEvent } from '../services/finance-integration.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const secret = String(process.env.CLAREIA_FINANCE_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      return res.status(503).json({ message: 'Webhook financeiro nao configurado.' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const timestamp = req.get('x-clareia-timestamp');
    const signature = req.get('x-clareia-signature');
    if (!verifyFinanceWebhook({ secret, timestamp, signature, rawBody })) {
      return res.status(401).json({ message: 'Assinatura do webhook invalida.' });
    }

    const event = parseFinanceEvent(rawBody);
    const result = await receiveFinanceEvent(event);
    return res.status(result.status === 'applied' ? 200 : 202).json(result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return res.status(400).json({ message: 'Evento financeiro invalido.' });
    }
    return next(error);
  }
});

export default router;