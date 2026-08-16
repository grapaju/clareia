import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    const error = new Error('JWT_SECRET nao configurado.');
    error.status = 500;
    throw error;
  }
  return secret;
}

export function signAuthToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}
