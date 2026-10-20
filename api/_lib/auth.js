import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, json } from './db.js';

const scrypt = promisify(scryptCallback);
const COOKIE = 'guidance_session';

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookieValue(req) {
  const cookies = req.headers.cookie || '';
  const item = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  return item ? decodeURIComponent(item.slice(COOKIE.length + 1)) : '';
}

function cookieHeader(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export async function createSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db()`INSERT INTO app_sessions (token_hash, user_id, expires_at, created_at)
    VALUES (${tokenHash}, ${userId}, now() + interval '8 hours', now())`;
  res.setHeader('Set-Cookie', cookieHeader(token, SESSION_MS / 1000));
}

export async function currentUser(req) {
  const token = cookieValue(req);
  if (!token || token.length > 100) {
    await db()`SELECT 1`;
    return null;
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const rows = await db()`
    SELECT u.id, u.email
    FROM app_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function requireUser(req, res) {
  const user = await currentUser(req);
  if (user) return user;
  json(res, 401, { error: 'Please sign in to continue.' });
  return null;
}

export async function clearSession(req, res) {
  const token = cookieValue(req);
  if (token && token.length <= 100) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await db()`DELETE FROM app_sessions WHERE token_hash = ${tokenHash}`;
  }
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}
