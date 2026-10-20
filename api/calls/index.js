import { db, json, method, readBody, validOrigin } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (req.method === 'GET') {
      const rows = await db()`
        SELECT id, student_name AS "studentName", grade_section AS "gradeSection",
          parent_name AS "parentName", concern, scheduled_at AS "scheduledAt", status,
          private_note AS "privateNote", created_at AS "createdAt"
        FROM parent_calls ORDER BY scheduled_at DESC LIMIT 500
      `;
      return json(res, 200, { calls: rows });
    }
    if (!method(req, res, 'POST')) return;
    if (!validOrigin(req)) return json(res, 403, { error: 'Request could not be verified.' });
    const body = readBody(req);
    const studentName = String(body.studentName || '').trim();
    const scheduledAt = new Date(body.scheduledAt);
    const gradeSection = String(body.gradeSection || '').trim();
    const parentName = String(body.parentName || '').trim();
    const concern = String(body.concern || '').trim();
    const privateNote = String(body.privateNote || '').trim();
    const status = ['Pending', 'Scheduled', 'Completed', 'No answer'].includes(body.status) ? body.status : 'Pending';
    if (!studentName || studentName.length > 150 || Number.isNaN(scheduledAt.getTime()) ||
      gradeSection.length > 100 || parentName.length > 150 || concern.length > 300 || privateNote.length > 2000) {
      return json(res, 400, { error: 'Check the required fields and try again.' });
    }
    const rows = await db()`
      INSERT INTO parent_calls (student_name, grade_section, parent_name, concern, scheduled_at, status, private_note, created_by)
      VALUES (${studentName}, ${gradeSection}, ${parentName}, ${concern}, ${scheduledAt.toISOString()}, ${status}, ${privateNote}, ${user.id})
      RETURNING id, student_name AS "studentName", grade_section AS "gradeSection",
        parent_name AS "parentName", concern, scheduled_at AS "scheduledAt", status,
        private_note AS "privateNote", created_at AS "createdAt"
    `;
    return json(res, 201, { call: rows[0] });
  } catch (error) {
    console.error('Calls request failed:', error.message);
    return json(res, 500, { error: 'Could not load or save calls.' });
  }
}
