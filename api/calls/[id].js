import { db, json, readBody, validOrigin } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

const statuses = ['Pending', 'Scheduled', 'Completed', 'No answer'];

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!['PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'PATCH, PUT, DELETE');
      return json(res, 405, { error: 'Method not allowed.' });
    }
    if (!validOrigin(req)) return json(res, 403, { error: 'Request could not be verified.' });
    const id = String(req.query.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'Call not found.' });

    if (req.method === 'PATCH') {
      const { status } = readBody(req);
      if (!statuses.includes(status)) return json(res, 400, { error: 'Choose a valid call status.' });
      const rows = await db()`
        UPDATE parent_calls SET status = ${status}, updated_at = now()
        WHERE id = ${id} RETURNING id
      `;
      if (!rows.length) return json(res, 404, { error: 'Call not found.' });
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const rows = await db()`DELETE FROM parent_calls WHERE id = ${id} RETURNING id`;
      if (!rows.length) return json(res, 404, { error: 'Call not found.' });
      return json(res, 200, { ok: true });
    }

    const body = readBody(req);
    const studentName = String(body.studentName || '').trim();
    const scheduledAt = new Date(body.scheduledAt);
    const gradeSection = String(body.gradeSection || '').trim();
    const parentName = String(body.parentName || '').trim();
    const concern = String(body.concern || '').trim();
    const privateNote = String(body.privateNote || '').trim();
    const status = statuses.includes(body.status) ? body.status : 'Pending';
    if (!studentName || studentName.length > 150 || Number.isNaN(scheduledAt.getTime()) ||
      gradeSection.length > 100 || parentName.length > 150 || concern.length > 300 || privateNote.length > 2000) {
      return json(res, 400, { error: 'Check the required fields and try again.' });
    }
    const rows = await db()`
      UPDATE parent_calls
      SET student_name = ${studentName}, grade_section = ${gradeSection}, parent_name = ${parentName},
          concern = ${concern}, scheduled_at = ${scheduledAt.toISOString()}, status = ${status},
          private_note = ${privateNote}, updated_at = now()
      WHERE id = ${id} RETURNING id
    `;
    if (!rows.length) return json(res, 404, { error: 'Call not found.' });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Call change failed:', error.message);
    return json(res, 500, { error: 'Could not update the call.' });
  }
}
