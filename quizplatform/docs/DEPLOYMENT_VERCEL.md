# Deploying Quizzler to Vercel ($0 Budget Stack)

This guide walks you through deploying **Quizzler** to [Vercel](https://vercel.com) using **Neon Managed PostgreSQL** and **Drizzle ORM** while maintaining our $0 budget architecture and 100 concurrent participants concurrency target.

---

## ⚡ Production Stack Architecture on Vercel

```
[Participants / Admins / Superadmins]
                 │
                 ▼ (HTTPS / TLS 1.3)
      ┌─────────────────────┐
      │     Vercel Edge     │
      │  Next.js 16 Proxy   │  (Stateless JWT Session Verification, Sub-5ms)
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  Vercel Serverless  │
      │  Functions (Node)   │  (Singleton Neon Pool Driver)
      └──────────┬──────────┘
                 │
                 ▼ (Encrypted WebSockets / Pooler)
      ┌─────────────────────┐
      │  Neon PgBouncer     │  (-pooler endpoint: multiplexes 100+ concurrent connections)
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  PostgreSQL Cluster │  (Drizzle ORM Relational Schema)
      └─────────────────────┘
```

---

## 📋 Step 1: Prepare Environment Variables for Vercel

In the Vercel Dashboard, go to **Project Settings** &rarr; **Environment Variables**. Add the following variables for **Production** and **Preview** environments:

| Variable Name | Required | Description | Example / Note |
|---|---|---|---|
| `DATABASE_URL` | **YES** | **Neon Pooled Connection String** | `postgresql://neondb_owner:***@ep-***-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`<br/>*(⚠️ MUST include `-pooler` in the host!)* |
| `DATABASE_URL_UNPOOLED` | Optional | Direct Neon Connection (for migrations) | `postgresql://neondb_owner:***@ep-***.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | **YES** | Secret key for signing session tokens | Generate with: `openssl rand -base64 32` (minimum 32 characters) |
| `NEXT_PUBLIC_APP_URL` | Optional | Production domain URL | `https://your-quizzler-app.vercel.app` |
| `DEFAULT_QUESTION_TIMER_SECONDS` | Optional | Default per-question countdown | `30` |
| `NODE_ENV` | Automatic | Managed by Vercel | `production` |

> [!IMPORTANT]
> **Always use Neon's Pooled connection string (`-pooler`) for `DATABASE_URL` on Vercel.**
> Vercel executes serverless functions on demand. The Neon PgBouncer pooler prevents connection exhaustion when up to 100 participants concurrently submit answers or poll live stage metrics.

---

## 🚀 Step 2: Deploy to Vercel

### Option A: Via GitHub / GitLab / Bitbucket (Recommended)
1. Push your Quizzler repository to your Git provider (e.g. GitHub):
   ```bash
   git init
   git add .
   git commit -m "feat: complete quizzler platform ready for vercel"
   git branch -M main
   git remote add origin https://github.com/your-username/quizzler.git
   git push -u origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com/new), click **"Add New..."** &rarr; **"Project"**.
3. Import your `quizzler` Git repository.
4. Framework Preset will be automatically detected as **Next.js**.
5. Expand **Environment Variables** and paste the variables from Step 1.
6. Click **Deploy**. Vercel will run `next build` and deploy your application in ~1-2 minutes.

---

### Option B: Via Vercel CLI
If you prefer deploying directly from your local terminal:
```bash
# 1. Install or invoke Vercel CLI
npx vercel

# 2. Follow prompts to link your project and deploy preview
# 3. Add production environment variables:
npx vercel env add DATABASE_URL
npx vercel env add JWT_SECRET

# 4. Deploy directly to production:
npx vercel --prod
```

---

## 🔐 Step 3: Initialize the First Super-Admin on Vercel

Once your deployment is live at `https://your-app.vercel.app`, you have two options to provision the root superadmin account:

### Method 1: Secure API Endpoint (No terminal required)
Send a single `POST` request to `/api/auth/setup-superadmin`:
```bash
curl -X POST https://your-app.vercel.app/api/auth/setup-superadmin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Administrator",
    "email": "superadmin@yourcollege.edu",
    "password": "YourSecurePassword123!"
  }'
```
*Note: This route permanently locks itself (returns `403 Forbidden`) as soon as the first Super-Admin is provisioned.*

### Method 2: Local Seeding Script
If your local machine has the connection strings configured in `.env.local`:
```bash
npm run seed:superadmin
```

---

## 🛡️ Production Verification Checklist

After deployment, test the key user flows:

1. **Super-Admin Login:** Visit `https://your-app.vercel.app/login` and log in with your superadmin credentials. Verify you are redirected to `/super-admin/dashboard` with the dark Linear/Dev-Ops Cyber console.
2. **Admin Quiz Studio:** Create a test quiz and questions at `/admin/quizzes`. Verify the room code and live stage proctoring panel.
3. **Participant Experience:** In an incognito window, register a team at `/register` (institution locked to `BIMTECH`). Join the live quiz via room code at `/participant/dashboard`. Verify one-question-at-a-time timer, anti-cheat detection, and blinded scorecard.
4. **Audit Radar:** In `/super-admin/audit-logs`, verify all authentication, quiz lifecycle, and proctoring telemetry events are captured.

---

## ⚡ Concurrency & Performance Guarantees

* **Serverless Pool Reuse:** `src/db/index.ts` implements a module-level singleton pattern that caches the Neon WebSocket pool across warm Vercel lambda container invocations.
* **Security Headers:** Pre-configured in `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
* **Stateless Edge Guard:** Next.js Proxy (`src/proxy.ts`) authenticates sessions statelessly via JWT cookies without database roundtrips on static asset or unauthorized route checks.
