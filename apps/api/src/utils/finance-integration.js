import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const FINANCE_WEBHOOK_MAX_AGE_SECONDS = 300;

const decimalAmountSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const financeEventSchema = z.object({
  id: z.string().uuid(),
  version: z.literal(1),
  type: z.enum([
    'finance.invoice.sent',
    'finance.invoice.overdue',
    'finance.invoice.partially_paid',
    'finance.invoice.paid',
  ]),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.literal('fluxo-caixa'),
  accountId: z.string().uuid(),
  data: z.object({
    invoiceId: z.string().uuid(),
    externalClientId: z.string().uuid(),
    clientName: z.string().trim().min(1).max(200),
    invoiceNumber: z.string().trim().min(1).max(100),
    dueDate: dateOnlySchema.nullable().optional(),
    totalAmount: decimalAmountSchema,
    paidAmount: decimalAmountSchema,
    remainingAmount: decimalAmountSchema,
    status: z.enum(['pending', 'partial', 'paid', 'canceled']),
    contextUrl: z.string().trim().startsWith('/').max(500).optional(),
  }).strict(),
}).strict();

export function signFinanceWebhook(secret, timestamp, rawBody) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function verifyFinanceWebhook({ secret, timestamp, signature, rawBody, now = Date.now() }) {
  if (!secret || !/^\d+$/.test(String(timestamp || ''))) return false;
  const requestTime = Number(timestamp) * 1000;
  if (!Number.isFinite(requestTime) || Math.abs(now - requestTime) > FINANCE_WEBHOOK_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  const expected = Buffer.from(signFinanceWebhook(secret, String(timestamp), rawBody));
  const received = Buffer.from(String(signature || ''));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseFinanceEvent(rawBody) {
  return financeEventSchema.parse(JSON.parse(rawBody));
}