import { json, method } from '../_lib/db.js';
import { currentUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  try {
    const user = await currentUser(req);
    return json(res, 200, { user: user ? { email: user.email } : null });
  } catch (error) {
    console.error('Session check failed:', error.message);
    return json(res, 500, { error: 'Could not check your session.' });
  }
}
