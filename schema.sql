CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prototype-only demo staff account: guidance@nvgchs.local / nvgchs123
INSERT INTO app_users (email, password_hash)
VALUES (
  'guidance@nvgchs.local',
  'scrypt$fe9db645bc3bd83a0e3cb0cd5d46642d$5520abfc87a0976358eccede8872ee76c1c25ce7cada29d274971f8348035dd33ed7b26a4d2084c411f2e34786fd99864013088e936091f305d717b83b593e24'
)
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS parent_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  grade_section TEXT NOT NULL DEFAULT '',
  parent_name TEXT NOT NULL DEFAULT '',
  concern TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Scheduled', 'Completed', 'No answer')),
  private_note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parent_calls_schedule_idx ON parent_calls(scheduled_at DESC);

-- Fictional sample records for a presentation demo; safe to run more than once.
INSERT INTO parent_calls (id, student_name, grade_section, parent_name, concern, scheduled_at, status, private_note, created_by)
SELECT sample.id, sample.student_name, sample.grade_section, sample.parent_name,
       sample.concern, sample.scheduled_at::timestamptz, sample.status, sample.private_note, staff.id
FROM (VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Sample Student 01', 'Grade 7 · Acacia', 'Sample Guardian 01', 'Attendance follow-up', '2026-10-20T09:30:00Z', 'Pending', 'Fictional demonstration record.'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Sample Student 02', 'Grade 8 · Narra', 'Sample Guardian 02', 'Academic check-in', '2026-10-20T11:00:00Z', 'Scheduled', 'Fictional demonstration record.'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Sample Student 03', 'Grade 9 · Acacia', 'Sample Guardian 03', 'Guidance referral', '2026-10-19T08:45:00Z', 'Completed', 'Fictional demonstration record.'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'Sample Student 04', 'Grade 10 · Narra', 'Sample Guardian 04', 'Well-being check-in', '2026-10-21T13:15:00Z', 'No answer', 'Fictional demonstration record.')
) AS sample(id, student_name, grade_section, parent_name, concern, scheduled_at, status, private_note)
CROSS JOIN LATERAL (SELECT id FROM app_users WHERE email = 'guidance@nvgchs.local' LIMIT 1) AS staff
WHERE NOT EXISTS (SELECT 1 FROM parent_calls existing WHERE existing.id = sample.id);
