import rateLimit from 'express-rate-limit';

const windowMs = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
const max = Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 600;

export const globalRateLimit = rateLimit({
	windowMs,
	max,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	validate: { trustProxy: false },
});
