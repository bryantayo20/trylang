import { createServer } from 'node:http';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback);
const root = dirname(fileURLToPath(import.meta.url));
const databaseDir = resolve(root, 'data');
const databasePath = resolve(databaseDir, 'guidance.sqlite');
const port = Number(process.env.PORT || 4173);
mkdirSync(databaseDir, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);
  CREATE TABLE IF NOT EXISTS parent_calls (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    grade_section TEXT NOT NULL DEFAULT '',
    parent_name TEXT NOT NULL DEFAULT '',
    concern TEXT NOT NULL DEFAULT '',
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (status IN ('Pending', 'Scheduled', 'Completed', 'No answer')),
    private_note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL REFERENCES app_users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS parent_calls_schedule_idx ON parent_calls(scheduled_at DESC);
`);

const demoEmail = 'guidance@nvgchs.local';
const demoHash = 'scrypt$fe9db645bc3bd83a0e3cb0cd5d46642d$5520abfc87a0976358eccede8872ee76c1c25ce7cada29d274971f8348035dd33ed7b26a4d2084c411f2e34786fd99864013088e936091f305d717b83b593e24';
database.prepare('INSERT OR IGNORE INTO app_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
  .run(randomBytes(16).toString('hex'), demoEmail, demoHash, Date.now());
const demoUser = database.prepare('SELECT id FROM app_users WHERE email = ?').get(demoEmail);
const demoCalls = [
  ['00000000000000000000000000000001', 'Sample Student 01', 'Grade 7 · Acacia', 'Sample Guardian 01', 'Attendance follow-up', '2026-10-20T09:30:00.000Z', 'Pending', 'Fictional demonstration record.'],
  ['00000000000000000000000000000002', 'Sample Student 02', 'Grade 8 · Narra', 'Sample Guardian 02', 'Academic check-in', '2026-10-20T11:00:00.000Z', 'Scheduled', 'Fictional demonstration record.'],
  ['00000000000000000000000000000003', 'Sample Student 03', 'Grade 9 · Acacia', 'Sample Guardian 03', 'Guidance referral', '2026-10-19T08:45:00.000Z', 'Completed', 'Fictional demonstration record.'],
  ['00000000000000000000000000000004', 'Sample Student 04', 'Grade 10 · Narra', 'Sample Guardian 04', 'Well-being check-in', '2026-10-21T13:15:00.000Z', 'No answer', 'Fictional demonstration record.'],
];
const seedCall = database.prepare(`INSERT OR IGNORE INTO parent_calls
  (id, student_name, grade_section, parent_name, concern, scheduled_at, status, private_note, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const [id, student, grade, parent, concern, scheduled, status, note] of demoCalls) {
  seedCall.run(id, student, grade, parent, concern, scheduled, status, note, demoUser.id, Date.now(), Date.now());
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(payload));
}

function getCookie(request, name) {
  const part = (request.headers.cookie || '').split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function sessionCookie(value, maxAge) {
  return `guidance_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 65536) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function requestOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

async function currentUser(request) {
  const token = getCookie(request, 'guidance_session');
  if (!token || token.length > 100) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return database.prepare(`SELECT u.id, u.email FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`).get(tokenHash, Date.now()) || null;
}

function unauthorized(response) {
  sendJson(response, 401, { error: 'Please sign in to continue.' });
}

async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handleApi(request, response, pathname) {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method) && !requestOriginAllowed(request)) {
    return sendJson(response, 403, { error: 'Request could not be verified.' });
  }
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await currentUser(request);
    return sendJson(response, 200, { user: user ? { email: user.email } : null });
  }
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const { email = '', password = '' } = await readJson(request);
    const normalized = String(email).trim().toLowerCase();
    const user = database.prepare('SELECT id, email, password_hash FROM app_users WHERE email = ? LIMIT 1').get(normalized);
    if (!user || !await verifyPassword(String(password), user.password_hash)) {
      return sendJson(response, 401, { error: 'Email or password is incorrect.' });
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    database.prepare('INSERT INTO app_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(tokenHash, user.id, expiresAt, Date.now());
    return sendJson(response, 200, { user: { email: user.email } }, { 'Set-Cookie': sessionCookie(token, 8 * 60 * 60) });
  }
  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = getCookie(request, 'guidance_session');
    if (token && token.length <= 100) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      database.prepare('DELETE FROM app_sessions WHERE token_hash = ?').run(tokenHash);
    }
    return sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (pathname.startsWith('/api/calls')) {
    const user = await currentUser(request);
    if (!user) return unauthorized(response);
    if (pathname === '/api/calls' && request.method === 'GET') {
      const calls = database.prepare(`SELECT id, student_name AS studentName, grade_section AS gradeSection,
        parent_name AS parentName, concern, scheduled_at AS scheduledAt, status,
        private_note AS privateNote, created_at AS createdAt
        FROM parent_calls ORDER BY scheduled_at DESC LIMIT 500`).all();
      return sendJson(response, 200, { calls });
    }
    if (pathname === '/api/calls' && request.method === 'POST') {
      const body = await readJson(request);
      const studentName = String(body.studentName || '').trim();
      const scheduledAt = new Date(body.scheduledAt);
      const gradeSection = String(body.gradeSection || '').trim();
      const parentName = String(body.parentName || '').trim();
      const concern = String(body.concern || '').trim();
      const privateNote = String(body.privateNote || '').trim();
      const statuses = ['Pending', 'Scheduled', 'Completed', 'No answer'];
      const status = statuses.includes(body.status) ? body.status : 'Pending';
      if (!studentName || studentName.length > 150 || Number.isNaN(scheduledAt.getTime()) || gradeSection.length > 100 || parentName.length > 150 || concern.length > 300 || privateNote.length > 2000) {
        return sendJson(response, 400, { error: 'Check the required fields and try again.' });
      }
      const id = randomBytes(16).toString('hex');
      const timestamp = new Date().toISOString();
      database.prepare(`INSERT INTO parent_calls (id, student_name, grade_section, parent_name, concern, scheduled_at, status, private_note, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, studentName, gradeSection, parentName, concern, scheduledAt.toISOString(), status, privateNote, user.id, timestamp, timestamp);
      return sendJson(response, 201, { call: { id, studentName, gradeSection, parentName, concern, scheduledAt: scheduledAt.toISOString(), status, privateNote, createdAt: timestamp } });
    }
    const match = pathname.match(/^\/api\/calls\/([0-9a-f-]{32}|[0-9a-f-]{36})$/i);
    if (match && request.method === 'PATCH') {
      const { status } = await readJson(request);
      if (!['Pending', 'Scheduled', 'Completed', 'No answer'].includes(status)) return sendJson(response, 400, { error: 'Choose a valid call status.' });
      const result = database.prepare('UPDATE parent_calls SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), match[1]);
      if (!result.changes) return sendJson(response, 404, { error: 'Call not found.' });
      return sendJson(response, 200, { ok: true });
    }
    if (match && request.method === 'PUT') {
      const body = await readJson(request);
      const studentName = String(body.studentName || '').trim();
      const scheduledAt = new Date(body.scheduledAt);
      const gradeSection = String(body.gradeSection || '').trim();
      const parentName = String(body.parentName || '').trim();
      const concern = String(body.concern || '').trim();
      const privateNote = String(body.privateNote || '').trim();
      const statuses = ['Pending', 'Scheduled', 'Completed', 'No answer'];
      const status = statuses.includes(body.status) ? body.status : 'Pending';
      if (!studentName || studentName.length > 150 || Number.isNaN(scheduledAt.getTime()) || gradeSection.length > 100 || parentName.length > 150 || concern.length > 300 || privateNote.length > 2000) {
        return sendJson(response, 400, { error: 'Check the required fields and try again.' });
      }
      const result = database.prepare(`UPDATE parent_calls SET student_name = ?, grade_section = ?, parent_name = ?, concern = ?, scheduled_at = ?, status = ?, private_note = ?, updated_at = ? WHERE id = ?`)
        .run(studentName, gradeSection, parentName, concern, scheduledAt.toISOString(), status, privateNote, new Date().toISOString(), match[1]);
      if (!result.changes) return sendJson(response, 404, { error: 'Call not found.' });
      return sendJson(response, 200, { ok: true });
    }
    if (match && request.method === 'DELETE') {
      const result = database.prepare('DELETE FROM parent_calls WHERE id = ?').run(match[1]);
      if (!result.changes) return sendJson(response, 404, { error: 'Call not found.' });
      return sendJson(response, 200, { ok: true });
    }
  }
  return sendJson(response, 404, { error: 'Not found.' });
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.avif': 'image/avif' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, decodeURIComponent(url.pathname));
    const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return sendJson(response, 403, { error: 'Forbidden.' });
    const contents = readFileSync(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    response.end(contents);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found.' });
    if (error instanceof SyntaxError || error.message === 'Request body is too large.') return sendJson(response, 400, { error: 'Invalid request.' });
    console.error(error);
    return sendJson(response, 500, { error: 'The app could not process that request.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`NVGCHS Guidance prototype running at http://127.0.0.1:${port}`);
  console.log(`Demo login: ${demoEmail} / nvgchs123`);
});
