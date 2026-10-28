# Quizzler — Live Competition & College Quiz Platform

A high-performance, real-time college competition engine built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Neon Managed PostgreSQL** via **Drizzle ORM**. Engineered under a **strict $0 infrastructure budget**.

---

## ⚡ Key Highlights
- **Strict $0 Budget Stack:** Neon Serverless PostgreSQL (free tier with PgBouncer transaction pooling) and edge-compatible Drizzle ORM.
- **Triple Design System Architecture:**
  - **Super-Admin Console (`/super-admin/*`):** Dark Cyber/Dev-Ops aesthetic inspired by Linear and high-density terminal interfaces (`#0A0D14` obsidian canvas, `#1E293B` slate borders, neon emerald/cyan/purple status accents, telemetry cards, audit radar, and key inspector).
  - **Admin Studio (`/admin/*`):** Socrative-inspired live proctoring dashboard with clean light surfaces, metric cards, live participant roster, and quick question injection.
  - **Participant Arena (`/participant/*`, `/login`, `/register`):** Bold, high-contrast Neobrutalism featuring hard black borders, offset drop shadows, and linear distraction-free quiz taking.
- **Super-Admin Governance & Master Answer Vault:**
  - **Audit Radar:** Structured append-only event trail across authentication, quiz lifecycles, role mutations, account blocks, and telemetry.
  - **Credential Directories:** Dedicated directories for Runners, Admins, and Superadmins with masked credential display, self-demotion guards, and last-superadmin protection.
  - **Account Blocking:** Instant server-authoritative session revocation for blocked accounts.
  - **Master Answer Vault:** Global inspection across all organizers with choice distribution analytics and safe question editing guarded by corruption prevention.
  - **Operational CLI Mockup:** Visibly inactive terminal interface (`[OPERATIONAL CLI RESERVED — INACTIVE IN PROD]`) with zero backend command execution.
- **Strict Question & Quiz Ownership:**
  - Every question records its creator (`createdBy`).
  - Admins can view, edit, reorder, or delete only their own quizzes and questions. Cross-admin operations are rejected with `ACCESS_DENIED`.
  - Super-admins retain global administrative access.
  - Data corruption prevention: cannot delete live quizzes or modify questions with existing submissions.
- **100 Concurrent Participants Concurrency Target:** Utilizes Neon's transaction pooler (`-pooler.neon.tech`) for application queries to prevent connection exhaustion.
- **Server-Authoritative Timers:** 30-second per-question timer calculated on the server with latency tolerance.
- **Linear Progression:** Questions are answered one-by-one with strictly no backtracking.
- **Low-Overhead Proctoring & Polling:** Efficient short-polling telemetry to eliminate expensive WebSocket subscriptions.

---

## 📚 Architectural & Planning Documentation
Complete specifications have been structured under the [`docs/`](docs/) directory:
- [**Product Requirements Document (PRD)**](docs/PRD.md)
- [**System Architecture & Schema Design**](docs/ARCHITECTURE.md)
- [**Phased Implementation Plan & Roadmap**](docs/IMPLEMENTATION_PLAN.md)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ or v24 LTS
- **npm**: v10+
- **Neon Account (Free Tier)**: A free serverless PostgreSQL database at [neon.tech](https://neon.tech)

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory by copying the example template:

```bash
cp .env.example .env.local
```

Fill in your Neon PostgreSQL connection URIs in `.env.local`:
```env
# Neon Pooled connection (for application traffic):
DATABASE_URL=postgresql://<user>:<password>@ep-<project>-pooler.<region>.aws.neon.tech/<dbname>?sslmode=require

# Neon Direct connection (for Drizzle migrations):
DATABASE_URL_UNPOOLED=postgresql://<user>:<password>@ep-<project>.<region>.aws.neon.tech/<dbname>?sslmode=require

JWT_SECRET=your-random-32-character-secret
DEFAULT_QUESTION_TIMER_SECONDS=30
```

### 3. Push PostgreSQL Schema to Neon
Apply the Drizzle ORM schema to your Neon database:
```bash
npm run db:push
```

### 4. Initialize the First Super-Admin
```bash
npm run seed:superadmin
```

### 5. Verify Engine, Governance, Ownership & User Management Security
Run the automated superadmin governance, audit trail, and account blocking test suite:
```bash
npm run test:governance
```

Run the automated participant timed quiz engine test suite:
```bash
npm run test:engine
```

Run the automated multi-admin security test suite:
```bash
npm run test:ownership
```

Run the automated registration and super-admin user management test suite:
```bash
npm run test:users
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Build for Production & Local Test
```bash
npm run build
npm run start
```

---

## 🌐 Deploy to Vercel ($0 Budget Stack)

Quizzler is fully optimized for **Vercel Serverless Functions** with **Neon Managed PostgreSQL**:
- **Automatic Framework Detection:** Next.js 16 App Router with Turbopack.
- **PgBouncer Pooling:** Prevents connection starvation for 100 concurrent participants.
- **Security Headers:** Preconfigured `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.

For complete deployment instructions, see [**Vercel Deployment Guide**](docs/DEPLOYMENT_VERCEL.md).

### Quick Vercel Setup:
1. Import repository into [Vercel](https://vercel.com/new).
2. Add environment variables in Vercel project settings:
   - `DATABASE_URL` (Neon **pooled** connection string, e.g. `postgresql://neondb_owner:***@ep-***-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`)
   - `JWT_SECRET` (32+ character random string)
3. Deploy!
4. Initialize the Superadmin via `POST https://your-app.vercel.app/api/auth/setup-superadmin` or `npm run seed:superadmin`.
