import { json, method } from './_lib/db.js';

export default function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  const timezone = String(req.query?.timezone || 'Asia/Manila');
  try {
    new Intl.DateTimeFormat('en-PH', { timeZone: timezone }).format();
  } catch {
    return json(res, 400, { error: 'Use a valid timezone name.' });
  }
  const now = new Date();
  return json(res, 200, {
    timestamp: now.toISOString(),
    timezone,
    time: new Intl.DateTimeFormat('en-PH', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(now),
    date: new Intl.DateTimeFormat('en-PH', { timeZone: timezone, dateStyle: 'full' }).format(now),
  });
}

