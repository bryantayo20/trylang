import { db, json, method, readBody, validOrigin } from '../_lib/db.js';
import { createSession, verifyPassword } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!validOrigin(req)) return json(res, 403, { error: 'Request could not be verified.' });
  try {
    const { email = '', password = '' } = readBody(req);
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail.length > 254 || String(password).length > 200) {
      return json(res, 400, { error: 'Enter a valid email and password.' });
    }
    const rows = await db()`SELECT id, email, password_hash FROM app_users WHERE email = ${normalizedEmail} LIMIT 1`;
    const user = rows[0];
    const accepted = user && await verifyPassword(String(password), user.password_hash);
    if (!accepted) return json(res, 401, { error: 'Email or password is incorrect.' });
    await createSession(res, user.id);
    return json(res, 200, { user: { email: user.email } });
  } catch (error) {
    console.error('Login failed:', error.message);
    if (!process.env.DATABASE_URL) {
      return json(res, 503, { error: 'Hindi pa nakakonekta ang Vercel database. I-set ang DATABASE_URL at patakbuhin ang schema.sql.' });
    }
    return json(res, 500, { error: 'Sign in is temporarily unavailable.' });
  }
}
