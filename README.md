# Ewall App

Next.js App Router + Prisma + PostgreSQL + NextAuth + RBAC application with billing, entitlements, DMV workflows, IFTA, UCR, 2290, documents, and admin settings.

## Local Development

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production With PM2

Typical production flow:

```bash
npm install
npx prisma generate
npm run build
pm2 start npm --name ewall-app -- start
pm2 save
pm2 startup
```

If you update environment variables in `.env`, reload PM2 with:

```bash
pm2 restart ewall-app --update-env
```

## Cron Jobs On Your Own Server

This app does not require Vercel Cron. If you deploy on your own VPS with PM2, keep the app running with PM2 and schedule cron jobs with Linux `crontab`.

### Required Environment Variable

Add a shared secret in `.env`:

```env
CRON_SECRET="replace-with-a-long-random-secret"
```

Then restart the app:

```bash
pm2 restart ewall-app --update-env
```

### Internal Cron Endpoints

Current internal cron routes:

- `POST /api/v1/internal/cron/billing`
- `POST /api/v1/internal/cron/dmv`

Each route accepts either:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

When the cron runs on the same server, use `127.0.0.1` so the request stays local:

```bash
curl -X POST "http://127.0.0.1:3000/api/v1/internal/cron/billing" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Why Billing Runs Daily

Billing plans can be monthly or yearly, but the billing cron should still run daily.

Reason:

- the cron does not charge everyone every day
- it only checks subscriptions whose `currentPeriodEnd <= now`
- this is safer for renewals, retries, grace periods, and missed runs after downtime

### Recommended Crontab

Open crontab:

```bash
crontab -e
```

Add these entries:

```bash
# Billing renewals every day at 3:00 AM
0 3 * * * curl -sS -X POST "http://127.0.0.1:3000/api/v1/internal/cron/billing" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/ewall-billing-cron.log 2>&1

# DMV daily processing every day at 4:00 AM
0 4 * * * curl -sS -X POST "http://127.0.0.1:3000/api/v1/internal/cron/dmv" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/ewall-dmv-cron.log 2>&1
```

If your app runs on a different port, replace `3000`.

### Manual Cron Test

Before relying on cron, test each job manually:

```bash
curl -X POST "http://127.0.0.1:3000/api/v1/internal/cron/billing" -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -X POST "http://127.0.0.1:3000/api/v1/internal/cron/dmv" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected billing response shape:

```json
{
  "ok": true,
  "result": {
    "renewed": 0,
    "failed": 0,
    "expiredCanceled": 0,
    "scanned": 0
  }
}
```

### Notes

- PM2 keeps the Node app alive.
- Linux `cron` is what actually schedules the recurring jobs.
- If you use Nginx in front of Next.js, you can still call `127.0.0.1:3000` from cron.
- Keep `CRON_SECRET` out of source control.
