import { json, method, validOrigin } from '../_lib/db.js';
import { clearSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!validOrigin(req)) return json(res, 403, { error: 'Request could not be verified.' });
  try {
    await clearSession(req, res);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Logout failed:', error.message);
    return json(res, 500, { error: 'Could not sign out right now.' });
  }
}
