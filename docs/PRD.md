# Product Requirements Document (PRD)
## Quizzler — Live Competition & College Quiz Platform
### Architecture: Strict $0 Budget &bull; Neon Serverless PostgreSQL &bull; Drizzle ORM

---

### 1. Executive Summary & Vision
**Quizzler** is a real-time, tamper-resistant web competition engine tailored for college fests, academic quiz bowls, and hackathon qualifiers. Operating under a **strict $0 infrastructure budget**, Quizzler combines server-authoritative question deadlines, anti-cheat tab switch telemetry, one-way question traversal, and a dual-design-system architecture:
1. **Admin / Super-Admin Studio:** Socrative-inspired, information-dense proctoring dashboard featuring clean light surfaces, subtle borders, compact metric cards, live participant progress tables, and live question telemetry.
2. **Participant Arena:** High-contrast Neobrutalism featuring bold borders, hard black shadows, and high-focus linear question answering.

The application stack is strictly standard and free-tier compatible:
- **Framework:** Next.js 16+ (App Router) with TypeScript
- **Styling:** Tailwind CSS (Separate Admin Socrative system & Public Neobrutalist tokens)
- **Database:** Neon Managed PostgreSQL (serverless free tier with connection pooling)
- **ORM & Data Layer:** Drizzle ORM with `@neondatabase/serverless`
- **Authentication:** Stateless Web Crypto JWT (`jose`) + `bcryptjs` + HTTP-only cookies, persisted in PostgreSQL

The platform operates across three discrete roles:
- **Participant:** High-focus, distraction-free quiz taking with linear progression and real-time timer tracking.
- **Admin:** Event organizers who manage quizzes and their own question bank, launch live rooms, monitor participants live via lightweight polling, evaluate leaderboards, and qualify candidates for subsequent rounds.
- **Super-Admin:** Platform administrators with system-wide oversight, cross-admin question review, user role management, answer keys access, and comprehensive immutable audit logging.

---

### 2. User Roles & Permissions Matrix

| Capability / Action | Participant | Admin | Super-Admin |
| :--- | :---: | :---: | :---: |
| Self-Registration & Authentication | ✅ | ✅ | ✅ |
| Profile View & Personal History | ✅ | ✅ | ✅ |
| Join Live Quiz (via room code/link) | ✅ | ❌ | ❌ |
| Answer Timed Questions (One-Way) | ✅ | ❌ | ❌ |
| View Immediate Feedback / Results | If Released | ✅ | ✅ |
| Create, Edit & Delete Quizzes | ❌ | ✅ (Owned Only) | ✅ (Global) |
| Create, Edit & Delete Questions | ❌ | ✅ (Owned Only) | ✅ (Global) |
| Manage Another Admin's Questions | ❌ | ❌ (Strictly Denied) | ✅ (Global) |
| Launch / Pause / End Live Sessions | ❌ | ✅ (Owned Only) | ✅ (Global) |
| Live Proctoring / Participant Monitor | ❌ | ✅ (Owned Only) | ✅ (Global) |
| View Detailed Leaderboard & Analytics | When Closed | ✅ | ✅ |
| Toggle Result Visibility / Publish Scores | ❌ | ✅ (Owned Only) | ✅ (Global) |
| Qualify Participants for Next Round | ❌ | ✅ (Owned Only) | ✅ (Global) |
| User Management (Roles, Status) | ❌ | ❌ | ✅ |
| System Audit Logs Inspection | ❌ | ❌ | ✅ |

---

### 3. Core Feature Specifications

#### 3.1 Simplified Team Registration & Authentication (PostgreSQL + Jose JWT)
- **Auth Engine:** Stateless JWT session management (`jose`) stored in secure, HTTP-only, `SameSite=Lax` cookies.
- **User Storage:** Single PostgreSQL `users` table managed via Drizzle ORM.
- **Simplified Registration Inputs:**
  1. **Team Name:** Required string stored separately in `users.team_name`.
  2. **Team Leader Email:** Required, validated, and normalized to lowercase.
  3. **Password:** Required (min 6 characters), hashed with `bcryptjs`.
  4. **Institution Name:** Displayed as `BIMTECH` (read-only in browser, strictly enforced on server).
- **Automatic Display Name Derivation:** Display name/username (`users.name`) is automatically derived from the email prefix (characters before the first `@`, e.g. `rahul.sharma@example.com` &rarr; `rahul.sharma`).
- **Default Registration Role:** Always `PARTICIPANT`. Admin and Super-Admin roles are provisioned by Super-Administrators.
- **Initial Super-Admin Seeding:** CLI seed script (`scripts/seed-superadmin.mjs`) reading `.env.local` credentials.

#### 3.2 Question & Quiz Ownership (Strict Multi-Admin Security)
- **Ownership Invariant:** Every question and quiz records its author in `created_by` (UUID referencing `users.id`).
- **Isolation:** An admin can view, edit, reorder, or delete only questions and quizzes they created. Server actions and API routes enforce this check on every operation; hiding buttons in the UI is never relied upon.
- **Super-Admin Oversight:** Super-admins retain global administrative permissions across all quizzes and draft questions.
- **Data Integrity Protection:** Quizzes with active participant submissions cannot be deleted. Questions with submitted answers cannot have their options, points, or correct answers modified.

#### 3.3 Super-Admin Dev-Ops Console & Governance (Dark Linear Architecture)
- **Visual Design Identity:** High-density, dark Linear/Cyber aesthetic (`#0A0D14` obsidian canvas, subtle borders `#1E293B`, glowing neon accents `#00F59B` emerald, `#00E5FF` electric cyan, `#8B5CF6` violet, `#EF4444` crimson). Distinctly scoped to `/super-admin/*` with zero impact on Admin (Socrative) or Participant (Neobrutalism) design systems.
- **Root Overview Dashboard (`/super-admin/dashboard`):**
  - High-level telemetry: Uptime (99.98%), Neon PostgreSQL pooled slot health, cluster quizzes, active defocus strikes, and ingested audit events.
  - Previews of the Master Answer Vault, Credential Directory, and Live Audit Radar.
- **Three Dedicated Account Directories:**
  1. **Runners Directory (`/super-admin/users`):** Competitor accounts with tab switch strikes, team affiliations, and access status.
  2. **Admins Directory (`/super-admin/admins`):** Event organizer accounts with role mutation and suspension controls.
  3. **Superadmins Directory (`/super-admin/superadmins`):** Root platform operators with self-demotion and last-superadmin protection guards.
  - **Zero Credential Exposure:** Queries and responses strictly omit password hashes and plaintext credentials. Encrypted status displayed with masked bcrypt indicator.
- **Role Governance:**
  - Intuitive transitions: `user ↔ admin ↔ superadmin`.
  - Mandatory confirmation modal before mutations, highlighting elevated privilege risks.
  - Self-demotion guard: Superadmins cannot demote their own account.
  - Last Super-Admin guard: Demoting the final remaining root admin is blocked on the server.
- **Account Blocking & Immediate Session Revocation:**
  - One-click blocking with optional administrative reason for suspicious activity.
  - Immediate server-side enforcement across authentication, session guards (`requireRole`), and server actions.
  - Blocked accounts receive explicit rejection messages and cannot create quizzes or submit answers.
  - Unblocking restores access without data loss or referential corruption.
  - Safeguard: Superadmins cannot be blocked.
- **Master Answer Vault & Key Inspector (`/super-admin/quizzes`):**
  - Consolidated view of all competitions, questions, and verified master answer keys with checksums.
  - Live response choice distribution percentages (A/B/C/D) calculated from real participant answers.
  - Safe editing of question prompts, options, correct answers, time limits, and points.
  - **Corruption Prevention Invariant:** Questions with active participant submissions cannot have their options or correct answers altered, protecting historical scorecards.
- **Live Event & Audit Radar (`/super-admin/audit-logs`):**
  - Append-only immutable log stream tracking authentication, quiz lifecycles, role mutations, account blocks, and proctoring telemetry.
  - Searchable by actor, action name, target entity, and safe display labels.
  - Filterable by event category (`AUTHENTICATION`, `QUIZ`, `USER_MANAGEMENT`, `SECURITY`).
  - Expandable JSON metadata drawer and 1-click **Download Forensic Audit Packet** (JSON export).
- **Reserved Operational Console (`/super-admin/console` & Bottom Terminal Bar):**
  - Embedded read-only terminal mockup (`root@quizzler:~$`) matching Stitch reference.
  - Strictly inactive: command input disabled with "Console inactive — Operational CLI reserved" notice.
  - Zero backend execution endpoints or shell access to maintain strict zero-trust security.

#### 3.4 Admin Experience (Socrative-Inspired UI)
- **Top Navigation:** Launch (`/admin/dashboard`), Quizzes (`/admin/quizzes`), Rooms (`/admin/rooms`), Reports (`/admin/reports`), and Results & Live Stage (`/admin/live`).
- **Room Code Indicator:** Prominent room pill (e.g. `STG2-BIM`) with 1-click clipboard copying.
- **Live Proctoring Stage (`/admin/quizzes/[id]/live`):**
  - Session status banner (`LIVE`, `SCHEDULED`, `ENDED`) with instant control toggles (Score Visibility, Open Registration, Anti-Cheat Enforcement, Share live quiz with other Admins).
  - 4 Key Metric Cards: Total Registered, Active Responses, Average Accuracy (%), Flagged Integrity Events.
  - **Relocated Quick Question Injector:** Positioned immediately above the Live Participants table for seamless contextual workflow.
  - **Complete Question Progress Display:** Renders progress indicators for all questions in the deck (not capped at 5) with horizontal scrolling for large question sets.
  - **Student Answer Review Modal:** 1-click review modal displaying student submissions, correct answers, scoring, and Round 2 qualification toggle.
  - **4-Way Table Sorting:** Live sorting across Name (alphabetical), Score (numeric descending/ascending), Time (elapsed duration), and Tab-Switch Count.
- **Admin-to-Admin Quiz Sharing (`is_shared_with_admins`):**
  - Organizers can share live and draft quizzes with other authenticated administrators.
  - **Quizzes Studio (`/admin/quizzes`):** Shared quizzes appear alongside owned quizzes with organizer attribution (`Created by {name}`), a `Shared` badge, and quick filter pills (`MY QUIZZES`, `SHARED WITH ME`).
  - **Question Studio (`/admin/quizzes/[id]`):** Observer Admins can inspect all questions, points, timers, and explanations in view-only mode with add, edit, delete, and settings modifications strictly disabled.
  - **Competition Rooms (`/admin/rooms`) & Reports (`/admin/reports`):** Shared rooms and reports are visible to observer admins with organizer attribution.
  - **Live Stage Observer Clearance:** Observer Admins can enter active rooms to inspect telemetry in real time; the Quick Question Injector, review modal, candidate qualification, cadence selectors, "Show Student Names", "Show Answers", and stage toggles are disabled.
  - **Live Stage Fallback (`/admin/live`):** Automatically selects the most active owned or shared quiz, avoiding room code insertion collisions.

#### 3.5 Participant Experience (Neobrutalism Design)
- **Design Language:** High-contrast Neobrutalism with 3-4px bold black borders, hard offset drop shadows (`shadow-[4px_4px_0px_#000]`), and high-energy cyber accents (Cyber Yellow `#FFE600`, Cyan `#00F0FF`, Neo-Pink `#FF90E8`).
- **Participant Dashboard (`/participant/dashboard`):**
  - Displays authorized competitions categorized by status (`LIVE`, `SCHEDULED`, `ENDED`).
  - Room Code quick join bar (`src/components/participant/RoomCodeJoinBar.tsx`) allowing instant joining with room code input.
  - Dynamic action triggers: "Start Qualifier" (new attempt), "Resume Live Attempt" (existing in-progress attempt), or "View Scorecard" (completed attempt).
  - Prevents duplicate active attempts for the same participant and quiz.
- **Quiz Lobby (`/participant/quiz/[id]`):**
  - Displays quiz overview, rules, time limits, question counts, and proctoring warnings before entering the timed arena.
- **One-Question-at-a-Time Quiz Experience (`/participant/quiz/[id]/runner`):**
  - **Randomized Question Order:** Questions are shuffled using the Fisher-Yates algorithm on attempt initialization and persisted in `participant_attempts.question_order` (`jsonb`) to ensure a distinct question sequence per participant while preserving deterministic recovery on reload.
  - **Linear Progression (No Going Back):** Questions are answered strictly one at a time. The UI displays `🔒 PREVIOUS LOCKED [ONE-WAY PROGRESSION]`. Once an answer is locked or its timer expires, the question is graded and the runner advances without backward navigation.
  - **Visible Synchronized Countdown Timer:** Counts down from the server-configured time limit (default 30 seconds). At &le; 10s, transforms into high-urgency blinking red alert mode.
  - **Choice Locking & Progression:** Options turn vibrant Cyber Yellow when clicked with a `CHOICE LOCKED` badge. Clicking `CONFIRM CHOICE & NEXT QUESTION →` locks the response on the server.
  - **Automatic Timeout Advancement:** When the countdown hits zero, the runner auto-submits. If the server timestamp exceeds the deadline + grace period, the attempt records `timed_out: true` with 0 points awarded and advances.
  - **Final Completion Transition:** Submitting the final question automatically marks the attempt as `COMPLETED` and redirects to the results scorecard.
- **Server-Authoritative Timing & Master Key Protection:**
  - Timer deadlines are computed strictly on the backend: `deadline = current_question_started_at + timeLimitSeconds + 3s grace`.
  - Master answer keys (`correctOptionIds`) and `explanation` are completely stripped from question payloads delivered to the browser during the quiz.
  - Linear order enforcement rejects any out-of-order, skipped, or backtracked question submissions.
- **Refresh & Disconnect Recovery:**
  - Refreshing or reconnecting calls `getAuthoritativeCurrentQuestion`, which calculates remaining seconds based on `now - current_question_started_at`.
  - If the timer expired while disconnected, the server auto-advances the participant to the next question index.
- **Anti-Cheat Proctoring Telemetry & Admin Visibility Control:**
  - Listens for browser `visibilitychange` (tab switches) and window `blur` (focus loss).
  - Transmits non-blocking telemetry to PostgreSQL `proctoring_events` and increments `tab_switch_count`.
  - **Admin Toggle (`show_tab_switch_count`):** Admins can toggle participant awareness of proctoring on or off per quiz from the Live Stage / Question Studio.
    - **When Disabled (`false`, Default):** Proctoring telemetry is captured completely silently. The `GUARD: TAB LOCK ON` pill, tab switch counter badge, and warning popups/toasts are hidden; the runner subheader gracefully renders a 2-column layout; the lobby rules and runner footer omit anti-cheat warnings; and the post-quiz scorecard hides the Proctor Telemetry metric card so the participant remains unaware they were monitored.
    - **When Enabled (`true`):** Real-time indicator (`⚠️ Tab Switches: X/3 Flag`), header guard pill, instant warning toasts, and scorecard telemetry cards are rendered.
  - Zero camera recording or invasive device permissions required.
- **Results & Leaderboard Visibility (`/participant/quiz/[id]/results`):**
  - **Blinded Scorecard:** If `results_released = false`, score details, master keys, and answer explanations are blinded to prevent leaks while other participants finish.
  - **Released Scorecard:** If `results_released = true`, reveals total score, rank, time taken, accuracy percentage, and a full question-by-question review with explanations.
  - **Proctor Telemetry Card:** Tab violation telemetry on the scorecard is shown only if `show_tab_switch_count = true` (3 clean summary cards displayed when disabled, 4 cards when enabled).
  - **Top 10 Leaderboard:** When enabled by admin (`show_leaderboard = true` or `results_released = true`), displays a live podium and Top 10 team ranking without revealing private participant data.

---

### 4. Zero-Dollar Budget Constraints & Free Tier Limits

| Component | Free Tier Provider | Limits / Allowances | Strategy to Stay Free |
| :--- | :--- | :--- | :--- |
| **Compute & Hosting** | Vercel / Cloudflare / Node | Serverless invocations & bandwidth | Zero long-running server processes; edge-cached static assets. |
| **Database** | Neon Serverless PostgreSQL | **0.5 GiB storage**, **100 compute CU hours/mo**, PgBouncer pooling | Connection pooling (`-pooler`), short targeted queries, cold start suspension during inactivity. |
| **Real-Time Telemetry**| Next.js Polling Route | Standard HTTP requests | 3-5s throttled polling intervals; minimal payload deltas; no paid WebSocket brokers. |
