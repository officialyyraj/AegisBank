# Deploy AegisBank on Render

This project is configured for Render as a Node web service backed by Render Postgres. The repository includes `render.yaml`, a PostgreSQL Prisma schema, an initial migration, a Node production start command, and a Node-based seed command.

## What the Blueprint creates

The included Blueprint creates:

- A Render Web Service named `aegisbank`
- A Render Postgres database named `aegisbank-db`
- Automatic Prisma migration execution before each deploy
- Generated JWT secrets
- A health check at `/api/v1/health`

The Blueprint uses the Free plans for a demo. Free web services can sleep after inactivity, and Free Postgres has a 30-day expiration limit. Do not use the Free plans for production data.

## Before you start

1. Put this repository in GitHub.
2. Push the current branch, including `render.yaml`, `prisma/migrations/`, `package-lock.json`, and the updated `package.json`.
3. Do not commit `.env`, local databases, or KYC files.

From the repository directory:

```bash
git add .
git commit -m "prepare AegisBank for Render"
git push origin main
```

## Deploy with the Blueprint

1. Open [Render Dashboard](https://dashboard.render.com).
2. Click **New** and choose **Blueprint**.
3. Connect the GitHub repository containing AegisBank.
4. Select the branch containing `render.yaml`.
5. Review the resources and click **Apply**.
6. Choose the same region for the web service and Postgres database. The checked-in Blueprint uses Oregon. Change both `region` values together if needed.
7. Wait for the database to become available and for the web service build to finish.

Render reads the following commands from `render.yaml`:

```text
Build:       npm ci && npm run build
Pre-deploy:  npx prisma migrate deploy
Start:       npm start
Health:      /api/v1/health
```

The migration runs before the web service starts. It creates the database tables using the committed migration at `prisma/migrations/0001_init/migration.sql`.

## Deploy manually instead

If you do not want to use the Blueprint:

1. Create a **Postgres** service in Render.
2. Create a **Web Service** from the GitHub repository.
3. Set the web service region to the same region as Postgres.
4. Use these settings:

```text
Runtime:          Node
Build Command:    npm ci && npm run build
Pre-Deploy:       npx prisma migrate deploy
Start Command:    npm start
Health Check:     /api/v1/health
```

## Environment variables

The Blueprint creates most variables automatically. If configuring the service manually, add the following:

```text
NODE_ENV=production
DATABASE_URL=<Render Postgres internal connection string>
JWT_ACCESS_SECRET=<long random secret>
JWT_REFRESH_SECRET=<different long random secret>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
KYC_UPLOAD_DIR=/tmp/aegisbank/kyc
TRUST_PROXY=true
CORS_ORIGIN=
RATE_LIMIT_PER_MINUTE=100
AUTH_RATE_LIMIT_PER_MINUTE=10
```

Use the **Internal Database URL** from Render Postgres when the web service and database are in the same region. The URL should use PostgreSQL and normally includes `sslmode=require` when required by the database connection settings.

Generate secrets locally with:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Never use the sample values in `.env.example` as production secrets.

## Seed sample accounts

The seed script creates these demo users:

```text
Customer: alice@aegisbank.demo / Alice@12345
Admin:    admin@aegisbank.demo / Admin@12345
```

The sign-in screen also has buttons that fill the sample customer and administrator credentials.

To seed the Render database from your computer:

1. Open the Render Postgres service.
2. Open **Connect**.
3. Copy the **External Database URL**.
4. Run this command locally from the repository:

```bash
DATABASE_URL='PASTE_EXTERNAL_DATABASE_URL_HERE' npm run db:seed
```

The seed script intentionally clears existing demo users and banking data before recreating the sample data. Do not run it against a production database containing real data.

## Test the deployment

After the service is live, replace the hostname in these commands:

```bash
curl https://YOUR-SERVICE.onrender.com/api/v1/health
```

Expected response:

```json
{"status":"ok","db":"ok"}
```

Open the service URL in a browser and use the sample customer or administrator button. If the service was idle, the first request may take longer while the Free instance wakes up.

## KYC file storage

The Blueprint sets `KYC_UPLOAD_DIR=/tmp/aegisbank/kyc` so the Free demo can start without a paid disk. Files in this location are temporary and can disappear after restarts or redeploys.

For persistent KYC files, use object storage such as S3 or R2. Alternatively, upgrade the web service to a paid Render plan and attach a persistent disk mounted at `/var/data`, then set:

```text
KYC_UPLOAD_DIR=/var/data/kyc
```

Only files under the disk mount path are preserved. Render disks are single-instance storage, so do not scale a disk-backed service horizontally.

## Troubleshooting

### Build fails at `npm ci`

Make sure `package-lock.json` is committed and pushed. Render uses the lockfile for a reproducible Node install.

### Migration fails

Check that `DATABASE_URL` points to Render Postgres, not a `file:` SQLite URL. Confirm that the database and service are in the same Render region when using the internal URL.

### App starts but health is unhealthy

Open the service logs and check the database connection. The health endpoint is:

```text
/api/v1/health
```

### Login fails after deployment

Run the seed command against the Render database’s external URL. Confirm that the sign-in request is going to the Render hostname and that the browser is not using old local storage tokens.

### CORS errors from another frontend

Set `CORS_ORIGIN` to a comma-separated allowlist of exact origins, for example:

```text
https://your-frontend.example,https://www.your-frontend.example
```

## Official Render references

- [Deploy a Next.js app](https://render.com/docs/deploy-nextjs-app)
- [Create and connect to Render Postgres](https://render.com/docs/postgresql-creating-connecting)
- [Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Persistent disks](https://render.com/docs/disks)
- [Free service limitations](https://render.com/docs/free)
