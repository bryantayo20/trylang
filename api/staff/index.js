import { db, json, method, readBody, validOrigin } from '../_lib/db.js';
import { hashPassword, requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (req.method === 'GET') {
      const staff = await db()`SELECT id, email, created_at AS "createdAt" FROM app_users ORDER BY created_at ASC`;
      return json(res, 200, { staff });
    }
    if (!method(req, res, 'POST')) return;
    if (!validOrigin(req)) return json(res, 403, { error: 'Request could not be verified.' });
    const body = readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 200) {
      return json(res, 400, { error: 'Enter a valid email and a password of at least 8 characters.' });
    }
    const passwordHash = await hashPassword(password);
    const rows = await db()`
      INSERT INTO app_users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, created_at AS "createdAt"
    `;
    if (!rows.length) return json(res, 409, { error: 'That staff email already has an account.' });
    return json(res, 201, { staff: rows[0] });
  } catch (error) {
    console.error('Staff request failed:', error.message);
    return json(res, 500, { error: 'Could not load or create staff accounts.' });
  }
}

