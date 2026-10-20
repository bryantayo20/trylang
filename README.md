# NVGCHS Guidance Office prototype

A small Vercel-ready prototype for staff sign-in and parent-call records. It includes four clearly fictional sample records for presentations. `schema.sql` seeds the sample staff login and demo records; running it again will not duplicate those records.

The school seal is included in `public/school-seal.avif`. It was taken from the public NVGCHS image gallery: https://bongfra.wixsite.com/nvgchs/nvgchsimage1.

## Database

### Run it standalone

Requires Node.js 22.13 or newer. Run `npm start`, then open http://127.0.0.1:4173. The app creates a local SQLite database at `data/guidance.sqlite` automatically. The database is local to this computer and is not uploaded to Vercel.

### Deploy on Vercel

Vercel Functions do not provide a durable local SQLite file. For a Vercel deployment, this project uses PostgreSQL through Neon so call records persist across deployments. Connect a Postgres provider to the Vercel project and set `DATABASE_URL` in the Vercel project environment variables.

Run `schema.sql` in the hosted database SQL console. It creates the staff account, session, and call-record tables, then adds the sample staff login and four fictional sample records:

| Email | Password |
| --- | --- |
| `guidance@nvgchs.local` | `nvgchs123` |

There is no public registration or password-reset flow in this prototype. The demo login is for presentations only; keep real student records out of this deployment.

If sign-in reports that the service cannot be reached, make sure the latest code is deployed, the `DATABASE_URL` environment variable is set for the Vercel deployment, and `schema.sql` has been run against that database.

If Vercel has no database configured yet, the sample login opens presentation mode. Its call records are saved only in that browser and are not shared between devices. Connect Postgres and run `schema.sql` to use the shared database instead.

## Put it on Vercel

Import this folder as a new Vercel project or push it to a Git repository and import that repository in Vercel. The `api/` directory contains the serverless endpoints. Add `DATABASE_URL`, apply `schema.sql`, and deploy.

This is a prototype. Use fictional records only until the school approves production hosting, account administration, backups, and handling of student information.
