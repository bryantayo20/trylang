const SCHOOL_LOGO = 'public/school-seal.avif';
const DEMO_EMAIL = 'guidance@nvgchs.local';
const DEMO_PASSWORD = 'nvgchs123';
const DEMO_CALLS_KEY = 'nvgchs-guidance-demo-calls';
const DEMO_CALLS = [
  { id: 'demo-call-01', studentName: 'Sample Student 01', gradeSection: 'Grade 7 · Acacia', parentName: 'Sample Guardian 01', concern: 'Attendance follow-up', scheduledAt: '2026-10-20T01:30:00.000Z', status: 'Pending', privateNote: 'Fictional demonstration record.' },
  { id: 'demo-call-02', studentName: 'Sample Student 02', gradeSection: 'Grade 8 · Narra', parentName: 'Sample Guardian 02', concern: 'Academic check-in', scheduledAt: '2026-10-20T03:00:00.000Z', status: 'Scheduled', privateNote: 'Fictional demonstration record.' },
  { id: 'demo-call-03', studentName: 'Sample Student 03', gradeSection: 'Grade 9 · Acacia', parentName: 'Sample Guardian 03', concern: 'Guidance referral', scheduledAt: '2026-10-19T00:45:00.000Z', status: 'Completed', privateNote: 'Fictional demonstration record.' },
  { id: 'demo-call-04', studentName: 'Sample Student 04', gradeSection: 'Grade 10 · Narra', parentName: 'Sample Guardian 04', concern: 'Well-being check-in', scheduledAt: '2026-10-21T05:15:00.000Z', status: 'No answer', privateNote: 'Fictional demonstration record.' },
];
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let user = null;
let calls = [];
let localDemo = false;
let activeFilter = 'All';
let searchText = '';
let toastTimer;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('Hindi maabot ang login/database service. I-check kung naka-deploy ang API at naka-set ang DATABASE_URL sa Vercel.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function logo(extra = '') {
  return `<img class="school-logo ${extra}" src="${SCHOOL_LOGO}" alt="Nueva Vizcaya General Comprehensive High School seal" />`;
}

function renderAuth() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-brand">
        <div class="logo-row">${logo()}<div class="school-name">NUEVA VIZCAYA GENERAL COMPREHENSIVE HIGH SCHOOL<span>Guidance Office</span></div></div>
        <div class="brand-message"><div class="eyebrow">NVGCHS · Guidance Office</div><h1>Family support, organized.</h1><p>A simple, private workspace for recording parent calls and follow-ups.</p></div>
        <div class="brand-foot">Nueva Vizcaya General Comprehensive High School · Bayombong</div>
      </section>
      <section class="login-side">
        <div class="auth-card">
          ${logo()}
          <h2>Sign in</h2>
          <p class="auth-copy">Sign in to open the Guidance Office workspace.</p>
          <form id="auth-form">
            <div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" maxlength="254" required /></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="200" required /></div>
            <p class="privacy-note">Demo email: <strong>guidance@nvgchs.local</strong><br/>Demo password: <strong>nvgchs123</strong></p>
            <div id="auth-error" class="form-error" role="alert" hidden></div>
            <button class="button full" type="submit" id="auth-submit">Sign in</button>
          </form>
        </div>
      </section>
    </main>`;

  document.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const button = document.querySelector('#auth-submit');
    const errorBox = document.querySelector('#auth-error');
    button.disabled = true;
    button.textContent = 'Signing in…';
    errorBox.hidden = true;
    try {
      if (localDemo) {
        if (String(payload.email).trim().toLowerCase() !== DEMO_EMAIL || payload.password !== DEMO_PASSWORD) {
          throw new Error('Email or password is incorrect.');
        }
        user = { email: DEMO_EMAIL };
      } else {
        const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
        user = result.user;
      }
      await loadCalls();
      renderDashboard();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
}

async function loadCalls() {
  if (localDemo) {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_CALLS_KEY) || 'null');
      calls = Array.isArray(saved) ? saved : structuredClone(DEMO_CALLS);
    } catch { calls = structuredClone(DEMO_CALLS); }
    localStorage.setItem(DEMO_CALLS_KEY, JSON.stringify(calls));
    return;
  }
  const result = await request('/api/calls');
  calls = result.calls || [];
}

function saveDemoCalls() {
  if (localDemo) localStorage.setItem(DEMO_CALLS_KEY, JSON.stringify(calls));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderDashboard() {
  const pending = calls.filter((call) => call.status === 'Pending' || call.status === 'Scheduled').length;
  const completed = calls.filter((call) => call.status === 'Completed').length;
  const followUp = calls.filter((call) => call.status === 'No answer').length;
  const visibleCalls = calls.filter((call) => (activeFilter === 'All' || call.status === activeFilter) &&
    `${call.studentName} ${call.parentName} ${call.concern} ${call.gradeSection}`.toLowerCase().includes(searchText.toLowerCase()));
  const rows = visibleCalls.map((call) => `
    <tr>
      <td><strong>${escapeHtml(call.studentName)}</strong>${call.gradeSection ? `<div class="panel-caption">${escapeHtml(call.gradeSection)}</div>` : ''}</td>
      <td>${escapeHtml(call.concern || '—')}</td>
      <td>${formatDate(call.scheduledAt)}</td>
      <td><span class="status ${call.status}" aria-label="${escapeHtml(call.status)}">${escapeHtml(call.status)}</span></td>
      <td class="call-actions"><button class="row-action" type="button" data-edit-id="${escapeHtml(call.id)}">Edit</button><button class="row-action danger" type="button" data-delete-id="${escapeHtml(call.id)}">Delete</button><select class="row-action status-action" aria-label="Update status" data-call-id="${escapeHtml(call.id)}"><option value="">Status</option>${['Pending','Scheduled','Completed','No answer'].filter((status) => status !== call.status).map((status) => `<option value="${status}">${status}</option>`).join('')}</select></td>
    </tr>`).join('');

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="logo-row">${logo()}<div class="school-name">NUEVA VIZCAYA GENERAL COMPREHENSIVE HIGH SCHOOL<span>Guidance Office</span></div></div>
        <div class="nav-label">Workspace</div><button class="nav-item active" type="button">Parent calls<span class="count">${calls.length}</span></button>
        <div class="side-bottom"><div class="user-line"><div class="user-avatar">${escapeHtml((user?.email || 'G').slice(0,1).toUpperCase())}</div><div class="user-email" title="${escapeHtml(user?.email || '')}">${escapeHtml(user?.email || '')}</div></div><button class="signout" id="signout" type="button">Sign out</button></div>
      </aside>
      <main class="main">
        <header class="topbar"><div class="crumb">NVGCHS <span aria-hidden="true">›</span> <strong>Guidance Office</strong></div><div class="today">${new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(new Date())}</div></header>
        <section class="page">
          <div class="welcome"><div><div class="eyebrow">Guidance Office</div><h1>Parent call records</h1><p>Record family outreach and track follow-ups.</p></div><button class="button" id="new-call" type="button">＋ New parent call</button></div>
          <div class="summary"><div class="summary-card"><div class="summary-label">Open follow-ups</div><div class="summary-value">${pending}</div></div><div class="summary-card"><div class="summary-label">Completed</div><div class="summary-value">${completed}</div></div><div class="summary-card"><div class="summary-label">No answer</div><div class="summary-value">${followUp}</div></div></div>
          <section class="panel"><div class="panel-head"><div><div class="panel-title">Call records</div><div class="panel-caption">${localDemo ? 'Presentation mode: records are saved in this browser only.' : 'Only records entered by authorized staff appear here.'}</div></div></div>
            <div class="toolbar"><input class="search" id="search" type="search" placeholder="Search records" aria-label="Search records" value="${escapeHtml(searchText)}"/><select class="filter" id="filter" aria-label="Filter by status">${['All','Pending','Scheduled','Completed','No answer'].map((status) => `<option ${status === activeFilter ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
            <div class="table-wrap"><table><thead><tr><th>Student</th><th>Concern</th><th>Call date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="empty"><strong>${calls.length ? 'No matching records' : 'No call records yet'}</strong>${calls.length ? 'Try a different search or status.' : 'Add a parent call when you are ready.'}${calls.length ? '' : '<br/><button class="button" id="empty-new-call" type="button">＋ New parent call</button>'}</td></tr>`}</tbody></table></div>
          </section>
        </section>
      </main>
    </div>`;

  document.querySelector('#new-call')?.addEventListener('click', showCallForm);
  document.querySelector('#empty-new-call')?.addEventListener('click', showCallForm);
  document.querySelector('#filter').addEventListener('change', (event) => { activeFilter = event.target.value; renderDashboard(); });
  document.querySelector('#search').addEventListener('input', (event) => { searchText = event.target.value; const start = event.target.selectionStart; renderDashboard(); const input = document.querySelector('#search'); input.focus(); input.setSelectionRange(start, start); });
  document.querySelector('#signout').addEventListener('click', async () => {
    if (!localDemo) {
      try { await request('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* Expired sessions can still return to sign-in. */ }
    }
    user = null; calls = []; renderAuth(false);
  });
  document.querySelectorAll('[data-call-id]').forEach((select) => select.addEventListener('change', async (event) => {
    const id = event.target.dataset.callId;
    try {
      if (localDemo) {
        calls = calls.map((call) => String(call.id) === id ? { ...call, status: event.target.value } : call);
        saveDemoCalls();
      } else {
        await request(`/api/calls/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) });
        await loadCalls();
      }
      renderDashboard(); showToast('Call status updated.');
    } catch (error) { showToast(error.message, true); }
  }));
  document.querySelectorAll('[data-edit-id]').forEach((button) => button.addEventListener('click', () => {
    const call = calls.find((item) => String(item.id) === button.dataset.editId);
    if (call) showCallForm(call);
  }));
  document.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', async () => {
    const call = calls.find((item) => String(item.id) === button.dataset.deleteId);
    if (!call || !window.confirm(`Delete the sample call for ${call.studentName}?`)) return;
    try {
      if (localDemo) {
        calls = calls.filter((item) => String(item.id) !== String(call.id));
        saveDemoCalls();
      } else {
        await request(`/api/calls/${encodeURIComponent(call.id)}`, { method: 'DELETE' });
        await loadCalls();
      }
      renderDashboard(); showToast('Call record deleted.');
    } catch (error) { showToast(error.message, true); }
  }));
}

function showCallForm(existing = null) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${existing ? 'Edit parent call' : 'New parent call'}</h2><p>Save a confidential outreach record.</p></div><button class="close" type="button" aria-label="Close">×</button></div><form id="call-form"><div class="form-grid"><div class="field"><label for="student">Student name *</label><input id="student" name="studentName" maxlength="150" required/></div><div class="field"><label for="grade">Grade and section</label><input id="grade" name="gradeSection" maxlength="100"/></div><div class="field"><label for="parent">Parent or guardian</label><input id="parent" name="parentName" maxlength="150"/></div><div class="field"><label for="concern">Reason for call</label><input id="concern" name="concern" maxlength="300"/></div><div class="field"><label for="scheduled">Call date and time *</label><input id="scheduled" name="scheduledAt" type="datetime-local" required/></div><div class="field"><label for="status">Status</label><select id="status" name="status"><option>Pending</option><option>Scheduled</option><option>Completed</option><option>No answer</option></select></div></div><div class="field"><label for="note">Private note</label><textarea id="note" name="privateNote" maxlength="2000"></textarea></div><div id="call-error" class="form-error" role="alert" hidden></div><div class="form-actions"><button class="button secondary" id="cancel-call" type="button">Cancel</button><button class="button" type="submit">${existing ? 'Save changes' : 'Save call'}</button></div></form></section>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.close').addEventListener('click', close);
  backdrop.querySelector('#cancel-call').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  const dateInput = backdrop.querySelector('#scheduled');
  const localDateTime = existing ? new Date(existing.scheduledAt) : new Date();
  dateInput.value = new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  if (existing) {
    for (const [name, value] of Object.entries({ studentName: existing.studentName, gradeSection: existing.gradeSection, parentName: existing.parentName, concern: existing.concern, status: existing.status, privateNote: existing.privateNote })) {
      const input = backdrop.querySelector(`[name="${name}"]`);
      if (input) input.value = value || '';
    }
  }
  backdrop.querySelector('#student').focus();
  backdrop.querySelector('#call-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    const error = backdrop.querySelector('#call-error');
    const record = Object.fromEntries(new FormData(event.currentTarget).entries());
    record.scheduledAt = new Date(record.scheduledAt).toISOString();
    submit.disabled = true; submit.textContent = 'Saving…'; error.hidden = true;
    try {
      if (localDemo) {
        const updated = { ...record, id: existing?.id || `demo-call-${crypto.randomUUID()}` };
        calls = existing ? calls.map((call) => String(call.id) === String(existing.id) ? updated : call) : [updated, ...calls];
        saveDemoCalls();
      } else {
        await request(existing ? `/api/calls/${encodeURIComponent(existing.id)}` : '/api/calls', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(record) });
        await loadCalls();
      }
      activeFilter = 'All'; searchText = ''; close(); renderDashboard(); showToast(existing ? 'Call record updated.' : 'Call record saved.');
    } catch (problem) {
      error.textContent = problem.message; error.hidden = false; submit.disabled = false; submit.textContent = 'Save call';
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}

async function init() {
  try {
    const result = await request('/api/auth/me');
    if (result.user) { user = result.user; await loadCalls(); renderDashboard(); }
    else renderAuth(false);
  } catch {
    localDemo = true;
    renderAuth(false);
    showToast('Presentation mode: records are saved in this browser only.', true);
  }
}

init();
