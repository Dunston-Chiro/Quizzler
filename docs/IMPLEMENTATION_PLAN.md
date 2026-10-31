# Implementation Plan & Roadmap
## Quizzler — Live Competition & College Quiz Platform
### Stack: Next.js &bull; Neon Managed PostgreSQL &bull; Drizzle ORM &bull; Tailwind CSS

---

### Phase 1: Foundation, PostgreSQL Architecture & Auth (Completed)
- [x] Initial workspace analysis and environment configuration (Node.js LTS).
- [x] Create comprehensive specifications reflecting Neon PostgreSQL & Drizzle ORM:
  - `docs/PRD.md` (Product Requirements Document)
  - `docs/ARCHITECTURE.md` (System Architecture & Schema Design)
  - `docs/IMPLEMENTATION_PLAN.md` (Phased Roadmap)
- [x] Initialize Next.js 16+ project with TypeScript, ESLint, and Tailwind CSS.
- [x] Configure Drizzle ORM and `@neondatabase/serverless` connection singleton (`src/db/index.ts`).
- [x] Define PostgreSQL relational schema in `src/db/schema.ts` (`users`, `quizzes`, `questions`, `participant_attempts`, `participant_answers`, `proctoring_events`, `audit_logs`).
- [x] Create `drizzle.config.ts` supporting pooled app traffic and unpooled migration connections with dotenv support.
- [x] Implement authentication engine on PostgreSQL via Drizzle:
  - User registration (`registerAction` and `/api/auth/register`).
  - User login (`loginAction` and `/api/auth/login`).
  - Stateless JWT cookie sessions (`src/lib/session.ts`).
  - Server-side role authorization guards (`src/proxy.ts` and `src/lib/auth-guard.ts`).
- [x] Super-Admin seeding script (`scripts/seed-superadmin.mjs`) verified against Neon live cluster.
- [x] Remove obsolete MongoDB/Mongoose packages and files.

---

### Phase 2: Branding, Layout Separation & Dual Design Systems (Completed)
- [x] Platform officially branded as **Quizzler**.
- [x] Implement Dual Design System architecture:
  - **Admin / Super-Admin Area (`/admin/*`, `/super-admin/*`):** Socrative-inspired proctoring dashboard, light clean surfaces, subtle borders, blue accents (`#0284c7`), and proctor navigation bar.
  - **Participant Arena (`/`, `/login`, `/register`, `/participant/*`):** High-contrast Neobrutalism, bold 4px borders, hard drop shadows, and high-energy cyber accents.
- [x] Route-level design separation in `src/proxy.ts` and `src/components/Navbar.tsx`.

---

### Phase 3: Admin Quiz Studio & Ownership Enforcement (Completed)
- [x] Schema Migration:
  - Added `createdBy` FK referencing `users.id` in `questions`.
  - Added `questionType` (`MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`).
  - Added `roomCode` to `quizzes`.
  - Generated and applied Drizzle migration `drizzle/0001_superb_beyonder.sql`.
- [x] Multi-Admin Ownership Engine (`src/lib/quiz-service.ts`):
  - Strict ownership assertion (`assertOwnership`): admins cannot view, edit, reorder, or delete another admin's questions.
  - Super-admin global access retained.
  - Anti-corruption rules: prevents deleting live quizzes or altering questions with active participant submissions.
- [x] Automated Ownership Verification (`scripts/test-ownership.ts`):
  - 9-step automated test suite verifying cross-admin denial, owner access, and super-admin oversight (100% pass rate).
- [x] Socrative-Inspired Admin Interface:
  - Admin Header (`src/components/admin/AdminHeader.tsx`) with room code pill, clipboard copy, live indicator, and tab navigation.
  - Admin Launchpad (`src/app/admin/dashboard/page.tsx`): 3 major activity tiles (Competition Quiz, Space Race, Reports) and Quick Question injector.
  - Quiz Management Studio (`src/app/admin/quizzes/page.tsx` & `src/components/admin/QuizManagerClient.tsx`): search, status filtering, and quiz creation modal.
  - Interactive Question Studio (`src/app/admin/quizzes/[id]/page.tsx` & `src/components/admin/QuestionStudioClient.tsx`): question builder, option manager, correct answer toggles, timer settings, points, and reordering.
  - Competition Rooms (`src/app/admin/rooms/page.tsx`): room codes overview and status monitoring.
  - Performance Reports (`src/app/admin/reports/page.tsx`): attempt counts, average scores, and candidate selection links.

---

### Phase 4: Socrative Live Proctoring Stage (Completed)
- [x] Dynamic Live Stage Route (`src/app/admin/quizzes/[id]/live/page.tsx`) & Default Stage (`src/app/admin/live/page.tsx`).
- [x] Live Stage Client (`src/components/admin/LiveStageClient.tsx`):
  - Session status banner with controls (Score Visibility, Open Registration, Anti-Cheat Enforcement).
  - 4 Key Metric Cards: Total Registered, Active Responses, Class Accuracy (%), Flagged Integrity Events.
  - 2-Column Responsive Proctor Layout:
    - Left: Live participant roster with real-time status badges, progress, scores, tab-switch count, and Round 2 qualification toggle.
    - Right: Question accuracy breakdown and Quick Question injector.
  - Auto-refresh polling with manual refresh capability.

---

### Phase 5: Registration Simplification & Super-Admin User Management (Completed)
- [x] Simplified Team Registration:
  - Form collects Team Name, Team Leader Email, Password, and read-only BIMTECH institution.
  - Automatically derives team leader username from email prefix (`email.split("@")[0]`).
  - Stores `teamName` separately in `users.team_name` via migration `drizzle/0002_strange_longshot.sql`.
  - Server strictly enforces `collegeName = "BIMTECH"`.
  - Normalizes email to lowercase and enforces uniqueness.
  - Retains Neobrutalism design on registration and login.
- [x] Super-Admin User Directory & Role Governance (`/super-admin/users`):
  - Paginated, searchable user directory displaying team name, derived username, email, institution, role, and registration date.
  - Zero password hash exposure: queries strictly select safe non-sensitive columns.
  - Role Assignment: User (`PARTICIPANT`), Admin (`ADMIN`), Super Admin (`SUPER_ADMIN`).
  - Explicit role change confirmation modal.
  - Self-demotion guard prevents accidental removal of own super-admin status.
  - Last Super-Admin guard prevents demoting the final remaining active root admin.
  - Immediate role propagation: database validation in server-side guards eliminates stale session retention.
  - Comprehensive audit trail: logs `USER_ROLE_UPDATED` in `audit_logs`.
- [x] Automated Verification (`scripts/test-user-management.ts`):
  - Automated 10-step verification test suite passes with 100% success rate.

---

### Phase 6: Participant Timed Quiz Engine & Anti-Cheat (Completed)
- [x] Schema & Migration:
  - Added `showLeaderboard` boolean to `quizzes`.
  - Added `questionOrder` (`jsonb`) to `participantAttempts`.
  - Migration generated and applied: `drizzle/0003_nice_alex_power.sql`.
- [x] Participant Quiz Core Service (`src/lib/participant-quiz-service.ts`):
  - `getParticipantQuizzes`: lists authorized active, scheduled, and past competitions with attempt status.
  - `startOrResumeQuizAttempt`: validates `LIVE` status, prevents duplicate active attempts, performs Fisher-Yates question shuffle, and persists `question_order`.
  - `getAuthoritativeCurrentQuestion`: server-authoritative timer, auto-timeout advancement on disconnect, strictly sanitizes question payloads (omitting `correctOptionIds` and `explanation`).
  - `submitQuestionAnswer`: strict linear progression check, validates server deadline with 3s grace, grades with master keys, increments score, and handles idempotent resubmission.
  - `recordParticipantProctorEvent`: logs `TAB_SWITCH` and `WINDOW_BLUR` into `proctoring_events` and increments `tab_switch_count`.
  - `getParticipantResults`: blinded scorecard when `results_released = false`; complete question breakdown and explanations when `true`; Top 10 leaderboard when `show_leaderboard = true`.
- [x] Server Actions (`src/app/actions/participant-quiz.ts`):
  - `startQuizAttemptAction`, `submitAnswerAction`, `reportProctorViolationAction`, `joinQuizByRoomCodeAction`, `getActiveQuestionAction`.
- [x] UI Components & Pages (Neobrutalism Design System):
  - Dashboard (`/participant/dashboard`): competition cards, Room Code quick join bar (`RoomCodeJoinBar.tsx`), Start/Resume/Scorecard buttons.
  - Lobby (`/participant/quiz/[id]` & `QuizLobbyClient.tsx`): instructions, rules, timer details, Start button. Suppresses anti-cheat rule when `showTabSwitchCount = false`.
  - Timed Quiz Runner (`/participant/quiz/[id]/runner` & `TimedQuizRunnerClient.tsx`):
    - Arena header with Room Code and Tab Lock status (`GUARD: TAB LOCK ON` pill shown only when enabled).
    - Synchronized countdown timer with red alert state (&le; 10s).
    - Question counter and Neobrutalist progress bar.
    - Dual-Mode Proctoring Telemetry:
      - Silent Mode (default): header pill, telemetry subheader column, and warning popups/toasts are hidden (clean 2-column layout); events log silently to the database.
      - Visible Mode: real-time Tab Violations counter (`⚠️ Tab Switches: X/3 Flag`), header guard badge, and warning popups appear.
    - Objective prompt, code snippet renderer, and options grid with Cyber Yellow locked state.
    - `🔒 PREVIOUS LOCKED [ONE-WAY PROGRESSION]` indicator.
    - Auto-advance on timeout and final submission completion.
  - Scorecard & Results (`/participant/quiz/[id]/results` & `QuizResultsClient.tsx`):
    - Score banner, dynamic stat cards (3 cards when `showTabSwitchCount = false`, 4 cards with Proctor Telemetry when `true`).
    - Blinded notice when results unreleased; question-by-question breakdown when released.
    - Top 10 Leaderboard with podium rankings when enabled.
  - Admin Live Stage & Studio Integration:
    - Added "Show Top 10 Leaderboard" and "Show Tab Switch Count" toggle controls in `LiveStageClient.tsx`, `QuestionStudioClient.tsx`, and `QuizManagerClient.tsx` backed by database migration `0005_cheerful_lizard.sql`.
- [x] Automated Test Suite (`scripts/test-participant-quiz.ts`):
  - 13 comprehensive end-to-end tests covering joining, duplicate prevention, randomized question order, linear progression, server timing, timeout grading, disconnect recovery, telemetry, blinded scorecard, results release, Top 10 leaderboard, and cross-participant security (100% pass rate).
  - Added `"test:engine"` script to `package.json`.

---

### Phase 7: Super-Admin Governance & Auditing (Completed)
- [x] Schema & Migration:
  - Added `isBlocked` (boolean), `blockedReason` (text), and `blockedAt` (timestamp) to `users`.
  - Extended `audit_logs`: made `actorId` nullable (`onDelete: "set null"`), added `category` (varchar 50), `targetLabel` (text), `metadata` (jsonb), and `userAgent` (text).
  - Added composite indexes on `created_at` (DESC) and `category` in `audit_logs`.
  - Generated and applied Drizzle migration: `drizzle/0004_good_gravity.sql`.
- [x] Dedicated Linear/Cyber Dev-Ops Theme (Superadmin Only):
  - Scoped strictly to `/super-admin/*` via `SuperAdminShell.tsx` and `src/app/super-admin/layout.tsx`.
  - Preserves Admin (Socrative clean light) and Participant (Neobrutalism high-contrast) styling without leakage.
  - Obsidian palette (`#0A0D14`), slate borders (`#1E293B`), neon accents (Emerald `#00F59B`, Cyan `#00E5FF`, Purple `#8B5CF6`, Rose `#EF4444`).
  - Global telemetry header, navigation tabs, quick jump palette, operational status pills, and bottom inactive CLI status.
- [x] Live Audit Radar & Activity Logging System:
  - Service: `src/lib/activity-log-service.ts` & Server Actions: `src/app/actions/activity-logs.ts`.
  - Append-only structured logging across 5 categories: `AUTH`, `QUIZ_LIFECYCLE`, `USER_MANAGEMENT`, `SECURITY`, `SYSTEM`.
  - Programmatic sanitization of passwords, hashes, and authorization tokens before database persistence.
  - Instrumented across login/logout, quiz creation/updates/deletion/status, role updates, account blocks, and participant competition lifecycles.
  - Audit Radar UI (`/super-admin/audit-logs` & `AuditRadarClient.tsx`) with category filters, search, expandable event metadata drawer, and JSON packet export.
- [x] Account Directories & Role Governance:
  - Three dedicated directory views:
    - `/super-admin/users` (Participant runners)
    - `/super-admin/admins` (Quiz administrators)
    - `/super-admin/superadmins` (System superadmins)
  - Reusable dark directory table (`CredentialDirectoryClient.tsx`) with search, filter tabs, role mutation dropdowns, and block action modals.
  - Server-authoritative role transitions with self-demotion prevention and last-superadmin safeguard.
  - Account blocking and unblocking with reason logging. Immediate session revocation enforced via live database lookup in `requireRole`, `getCurrentUser`, `getRequiredAdminSession`, and auth endpoints.
  - Masked credential display (`argon2id$v=19$m=65536...`) preventing true hash exposure.
- [x] Master Answer Vault & Key Inspector:
  - Global quiz catalog (`/super-admin/quizzes` & `QuestionVaultClient.tsx`) across all organizers.
  - Detailed inspection drawer with question prompts, syntax-highlighted code snippets, verified master key badges with SHA-256 checksums, and live choice distribution percentages (A/B/C/D).
  - Safe question editing with corruption prevention rejecting option and answer key mutations on questions with active participant submissions.
- [x] Inactive Operational Console Panel:
  - Dedicated CLI route (`/super-admin/console`) and persistent bottom status bar.
  - Visibly marked `[OPERATIONAL CLI RESERVED — INACTIVE IN PROD]`.
  - Disabled input fields, zero backend execution handlers, zero remote command execution capabilities.
- [x] Automated Test Suite (`scripts/test-superadmin-governance.ts`):
  - 10-step end-to-end governance verification suite.
  - Verified audit trail capture, block session revocation, unblocking, credential masking, role demotion protection, answer vault distribution, corruption prevention, and question updates.
  - Added `"test:governance"` script to `package.json`.

---

### Phase 8: Load Testing & 100-Concurrent-Participant Verification
- [ ] Automated load testing script (`scripts/load-test-sim.mjs`):
  - Simulates 100 simultaneous participants fetching questions, submitting answers, and sending proctoring events.
  - Monitors Neon PgBouncer connection reuse and query latency.
  - Verifies database execution remains sub-20ms under peak load.

---

### Phase 9: Admin Live Dashboard Enhancements & Multi-Admin Shared Views (Completed)
- [x] Relocate Quick Question Injector:
  - Repositioned immediately above the Live Participants table for seamless contextual workflow.
  - Responsive collapsible card preserving all deck injection capabilities.
- [x] Complete Question Progress Display:
  - Expanded participant progress indicators from a 5-question cap to render all questions in the quiz.
  - Responsive horizontal scrolling wrapper maintaining fixed sticky participant columns.
- [x] Student Answer Review Modal:
  - Modal displaying selected student's submitted answers, correct keys, awarded scores, and question status.
  - Integrated Round 2 qualification / shortlisting toggle with server-side authorization enforcement.
- [x] 4-Way Live Participants Table Sorting:
  - Full client-side & server-backed sorting by Name (alphabetical), Score (numeric descending/ascending), Time (elapsed duration), and Tab-Switch Count.
- [x] Cross-Admin Quiz View Sharing & Observer Clearance:
  - Added `is_shared_with_admins` boolean column to `quizzes` via migration `0006_silly_groot.sql`.
  - Quizzes Studio (`/admin/quizzes`): Exposes shared quizzes with `👁️ Shared` pill, organizer attribution, and filter pills (`ALL`, `MY QUIZZES`, `SHARED WITH ME`).
  - Question Studio (`/admin/quizzes/[id]`): Granted view-only inspection access to other admins with question editing, adding, reordering, and settings modifications strictly disabled.
  - Competition Rooms (`/admin/rooms`) & Reports (`/admin/reports`): Exposes shared rooms and scoring reports with organizer attribution.
  - Live Stage Observer Clearance (`/admin/quizzes/[id]/live`): Non-owner admins enter in observer mode; Quick Question Injector, review modal, candidate qualification, "Show Student Names", "Show Answers", and stage controls are disabled.
  - Live Stage Fallback Bugfix (`/admin/live`): Prioritizes owned live quizzes, then shared live quizzes, then recent sessions. Fixed room code insertion collision (`STG2-BIM` unique constraint) by presenting an empty state if no eligible quizzes exist.
- [x] Automated Test Suite (`scripts/test-admin-live-enhancements.ts`):
  - 8-test verification suite covering question injection, full progress rendering, review modal, qualification toggle, 4-way sorting, cross-admin visibility, view-only enforcement, superadmin global clearance, and revocation on unsharing.
  - Added `"test:live"` script to `package.json`.
