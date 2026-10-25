# DOCUMENT 2 — AI CODING AGENT IMPLEMENTATION SPECIFICATION
## AegisBank — Build Instructions

Cross-references Document 1 (architecture/schema/API) and Document 3 (deployment). This document is
written to be executed directly by an AI coding agent starting from an empty repository.

Stack decision (binding): **Node.js 20 + TypeScript + Express + PostgreSQL (pg/Prisma) + React (Vite) +
Docker + AWS CDK**.

---

## 1. Implementation Strategy — Phases

- **Phase 0 — Repository setup**: scaffold monorepo, tooling, Docker Compose for local dev.
- **Phase 1 — Backend foundation**: Express app, config/env loading, health endpoint, error middleware.
- **Phase 2 — Database**: Prisma schema from Doc 1 §6, migrations, seed script.
- **Phase 3 — Authentication**: register/login/refresh, JWT middleware, RBAC (customer/admin).
- **Phase 4 — Core features**: Account, Transaction (Saga), Payment (mock) modules.
- **Phase 5 — Event bus & Fraud/Notification**: outbox table, publisher, polling worker, fraud rules, SES notification consumer.
- **Phase 6 — Frontend**: React app — auth, dashboard, transfer form, KYC upload, admin fraud view.
- **Phase 7 — Integration**: wire frontend to API, CORS, end-to-end manual pass.
- **Phase 8 — Testing**: unit, integration, API, E2E per Section 9.
- **Phase 9 — Production hardening**: security headers, rate limiting, secrets via env, logging cleanup.
- **Phase 10 — Deployment**: follow Document 3 exactly.

Each phase's acceptance criteria (Section 10) must pass before moving to the next.

---

## 2. Repository Structure

```
aegisbank/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # controllers, services, routes, validators
│   │   │   ├── kyc/
│   │   │   ├── accounts/
│   │   │   ├── transactions/
│   │   │   ├── payments/
│   │   │   ├── fraud/
│   │   │   └── notifications/
│   │   ├── eventbus/             # outbox publisher + polling worker
│   │   ├── middleware/           # auth.middleware, error.middleware, rateLimit.middleware
│   │   ├── config/                # env loading, constants
│   │   ├── db/                    # Prisma client, migrations wrapper
│   │   ├── app.ts                 # Express app assembly
│   │   └── server.ts              # entrypoint
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── api/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Login, Register, Dashboard, Transfer, KycUpload, AdminFraud
│   │   ├── components/
│   │   ├── api/                    # fetch wrappers
│   │   ├── state/                  # auth context / store
│   │   └── main.tsx
│   ├── Dockerfile (optional, for local only — prod is static export)
│   └── package.json
├── infrastructure/
│   ├── cdk/                        # AWS CDK app (see Document 3 Part E)
│   └── docker-compose.yml          # local dev: postgres + backend + frontend
├── scripts/
│   ├── seed-demo-data.sh
│   └── run-migrations.sh
├── docs/                            # this doc set
├── .github/workflows/ci-cd.yml
├── .env.example
└── README.md
```

Purpose of key dirs: `modules/*` = one directory per Doc 1 §5 component, each self-contained
(routes+service+repository) to preserve module boundaries even inside the monolith. `eventbus/` =
the only place events are published/consumed, enforcing decoupling. `infrastructure/cdk` = all AWS
resources as code (Document 3 Part E).

---

## 3. Module-by-Module Implementation

Each module = `routes.ts` (Express Router), `controller.ts`, `service.ts` (business logic),
`repository.ts` (Prisma queries), `validators.ts` (Zod schemas), `*.test.ts`.

### auth
- Files: `auth/{routes,controller,service,repository,validators}.ts`
- `service.register(email,password,full_name)`: hash password (bcrypt), insert user, return id.
- `service.login(email,password)`: verify hash, issue access+refresh JWT (`jsonwebtoken`).
- `service.refresh(refreshToken)`: verify, rotate, issue new access token.
- Middleware `requireAuth` (verifies JWT, attaches `req.user`), `requireRole('admin')`.
- Errors: 401 on bad creds/expired token, 409 on duplicate email.
- Tests: register success/duplicate, login success/failure, token expiry rejected.

### kyc
- Files as above. `POST /kyc/documents` uses `multer` for multipart upload → stream to S3
  (`kycBucket`, key `users/{userId}/{uuid}.{ext}`) → insert `kyc_documents` row status `pending`.
- Admin review endpoint updates status + publishes `kyc.status_changed` event; on `approved`,
  update `users.kyc_status`.
- Tests: file type/size validation rejected, admin-only review enforced.

### accounts
- `service.createAccount(userId, type)`: block if `users.kyc_status != 'approved'` → 403.
- `service.getStatement(accountId, from, to)`: query transactions where account is source or dest.
- Tests: creation blocked pre-KYC, statement date filtering.

### transactions (Saga)
- `service.transfer(sourceId, destId, amount)`:
  1. Begin DB transaction.
  2. Lock source row (`SELECT ... FOR UPDATE`), check `balance >= amount` else throw `InsufficientFundsError`.
  3. Debit source, credit destination, insert `transactions` row `status='completed'`.
  4. Commit DB transaction.
  5. On success: publish `transaction.created` to outbox (same DB transaction — outbox pattern ensures atomicity with the ledger write).
  6. On any exception before commit: rollback (Postgres does this natively — no separate "compensating" step needed since it's one DB transaction). If a true cross-service Saga is later needed (real microservices), implement compensating debit-reversal as described in Doc 1.
- Tests: happy path, insufficient funds, concurrent transfers on same account (row-lock correctness).

### payments (mock external rail)
- `service.topup(accountId, amount)`: insert `payments` row `status='pending'`, call
  `mockPaymentGateway.charge()` (a local stub function simulating latency + 95% success rate),
  on success update `status='completed'` + credit account + publish `payment.completed`; on failure
  after 3 retries mark `failed` + publish `payment.failed`.
- Tests: success path, simulated failure + retry exhaustion.

### fraud (event consumer, no public write API)
- Worker subscribes to `transaction.created` / `payment.completed` from outbox poller.
- Rule functions: `checkVelocity(accountId)`, `checkAmountThreshold(accountId, amount)`,
  `checkNewDevice(userId, deviceFingerprint)` (device fingerprint = header-based, simplified for demo).
- On any rule true → insert `fraud_flags` row, publish `fraud.flagged`.
- Admin routes: `GET /admin/fraud-flags`, `POST /admin/fraud-flags/:id/review`.
- Tests: each rule triggers/doesn't trigger correctly on synthetic data.

### notifications (event consumer)
- Subscribes to `transaction.created`, `fraud.flagged`, `kyc.status_changed`.
- `service.send(userId, eventType, channel='email')` → SES `SendEmailCommand`, insert `notifications` row.
- Tests: SES call mocked, failure doesn't throw uncaught.

### eventbus (outbox + poller)
- `publishEvent(eventType, payload)`: insert row into `event_outbox` **within the same DB transaction** as the domain write that triggered it (critical for consistency).
- `pollAndDispatch()`: runs every 2s (setInterval or a lightweight worker loop within the same process for demo simplicity — no separate worker service needed at this scale), selects `status='pending'` rows, dispatches to registered handlers (fraud, notification), marks `processed` or increments `attempts`/`failed` after 5 tries.
- Tests: event delivered to correct handler, retry/backoff on handler throw.

---

## 4. Database Implementation

- Use Prisma. `prisma/schema.prisma` mirrors Document 1 §6.2 exactly (all tables, types, constraints, indexes).
- Migration order: `users` → `kyc_documents` → `accounts` → `transactions` → `payments` → `fraud_flags` → `notifications` → `event_outbox`.
- Run via `npx prisma migrate deploy` in production, `prisma migrate dev` locally.
- Seed script (`prisma/seed.ts`): 1 admin user, 2 demo customers (KYC pre-approved), 2 accounts each with starting balance ₹50,000.
- Indexes: exactly as listed in Doc 1 §6.2 — add via Prisma `@@index`.

---

## 5. API Implementation

Map every Document 1 §7 endpoint to: `modules/<name>/routes.ts` → `controller.ts` → `service.ts` →
`repository.ts`. Apply `requireAuth` to all except `/auth/register`, `/auth/login`, `/auth/refresh`,
`/health`. Apply `requireRole('admin')` to all `/admin/*` and `/kyc/documents/:id/review`. Validate
every request body against a Zod schema in `validators.ts` before reaching the controller.

---

## 6. Frontend Implementation

**Pages:** Login, Register, Dashboard (account list + balances), Transfer, TopUp, KycUpload,
TransactionHistory, AdminFraudReview.

**State management:** React Context for auth (JWT + user), React Query (or simple fetch+useState) for
server data — keep it minimal, no Redux needed at this scale.

**API integration:** single `api/client.ts` wrapping `fetch`, attaches `Authorization` header, handles
401 by redirecting to login.

**Forms:** controlled inputs + client-side validation mirroring backend Zod schemas (amount > 0, etc.).

**Loading/error/empty states:** every data-fetching page must show a spinner while loading, an error
banner on failure, and an explicit empty state ("No transactions yet") — required for acceptance.

**Auth flow:** login → store tokens in memory + refresh token in httpOnly-equivalent (localStorage
acceptable for demo, documented as an open issue for production hardening) → auto-refresh on 401.

**Responsive:** basic mobile-friendly layout (CSS flexbox/grid), not pixel-perfect — demo-grade.

---

## 7. "AI" Implementation

No LLM/model integration in this build (Document 1 §8). This section intentionally minimal: fraud
rules are plain TypeScript functions (Section 3, `fraud` module) — no prompt templates, no external
AI API calls, no token cost. Do not add an LLM dependency unless explicitly requested later.

---

## 8. Environment Configuration

`.env.example` (backend):

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/aegisbank
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
AWS_REGION=ap-south-1
KYC_S3_BUCKET=aegisbank-kyc-docs-dev
SES_FROM_EMAIL=no-reply@example.com
CORS_ORIGIN=http://localhost:5173
```

| Variable | Required | Example | Purpose | Secret? |
|---|---|---|---|---|
| NODE_ENV | Yes | production | Runtime mode | No |
| PORT | Yes | 3000 | Listen port | No |
| DATABASE_URL | Yes | postgresql://... | Postgres connection | Yes |
| JWT_ACCESS_SECRET | Yes | (random 32+ bytes) | Sign access tokens | Yes |
| JWT_REFRESH_SECRET | Yes | (random 32+ bytes) | Sign refresh tokens | Yes |
| JWT_ACCESS_TTL | Yes | 900 | Access token lifetime (sec) | No |
| JWT_REFRESH_TTL | Yes | 604800 | Refresh token lifetime (sec) | No |
| AWS_REGION | Yes | ap-south-1 | AWS SDK region | No |
| KYC_S3_BUCKET | Yes | aegisbank-kyc-docs-prod | S3 bucket for KYC uploads | No |
| SES_FROM_EMAIL | Yes | no-reply@yourdomain.com | Verified SES sender | No |
| CORS_ORIGIN | Yes | https://app.yourdomain.com | Allowed frontend origin | No |

Never commit a real `.env`. In AWS, inject via ECS task definition environment + Secrets Manager
references for the two JWT secrets and `DATABASE_URL` (see Document 3 Part D).

---

## 9. Testing Strategy

**Unit tests:** every `service.ts` function in isolation (mock repository/DB) — password hashing,
Saga balance math, fraud rule thresholds, JWT sign/verify.

**Integration tests:** module + real test Postgres (Docker) — e.g. transfer end-to-end updates both
account balances correctly and inserts one transaction row; concurrent transfer requests don't
double-spend (row locking works).

**API tests:** every endpoint in Document 1 §7 — supertest against the Express app: happy path +
each documented error code.

**Frontend tests:** login flow, transfer form validation, KYC upload flow (React Testing Library).

**AI/fraud tests** (rule-based, not ML, but same category per report structure):
- Expected: normal transaction → no flag.
- Invalid input: negative/zero amount rejected before reaching fraud module.
- Adversarial: rapid-fire transactions from same account → velocity flag triggers.
- "Hallucination"-equivalent: N/A (deterministic rules can't hallucinate) — document this explicitly.
- Failure case: fraud worker throws mid-evaluation → transaction still completes (non-blocking), error logged.

**End-to-end (critical journeys):**
1. Register → KYC upload → admin approves → create account → transfer funds → see updated balance.
2. Large/rapid transfer → fraud flag appears in admin view → admin marks reviewed.
3. Top-up (mock) → balance increases → notification recorded.

---

## 10. Acceptance Criteria (sample — apply pattern to all features)

**Fund transfer**
- GIVEN a user with account A (balance ≥ amount) and account B
- WHEN they POST `/transactions` with a valid amount
- THEN account A's balance decreases by amount, account B's increases by amount, a `transactions`
  row with `status=completed` exists, and a `transaction.created` event is recorded in `event_outbox`.

**Insufficient funds**
- GIVEN account A balance < amount
- WHEN transfer requested
- THEN response is 422 `INSUFFICIENT_FUNDS` and no balances change.

**Fraud flag on velocity**
- GIVEN a user makes 4 transfers within 5 minutes
- WHEN the 4th `transaction.created` event is processed
- THEN a `fraud_flags` row is created with `severity` set and `reviewed_status='open'`.

Apply the same GIVEN/WHEN/THEN pattern to every endpoint in Document 1 §7 before considering Phase 8 done.

---

## 11. Implementation Order (dependency-aware task list)

| Task ID | Description | Dependencies | Files/modules | Completion criteria |
|---|---|---|---|---|
| T0 | Repo scaffold, tooling, Docker Compose | — | root, `infrastructure/docker-compose.yml` | `docker compose up` runs empty app + Postgres |
| T1 | Express app skeleton + health endpoint | T0 | `backend/src/app.ts`,`server.ts` | `GET /health` returns 200 |
| T2 | Prisma schema + migrations + seed | T1 | `prisma/*` | `prisma migrate dev` succeeds, seed inserts demo data |
| T3 | Auth module | T2 | `modules/auth/*` | register/login/refresh tests pass |
| T4 | KYC module | T3 | `modules/kyc/*` | upload + admin review tests pass |
| T5 | Accounts module | T3 | `modules/accounts/*` | create/list/statement tests pass |
| T6 | Event bus (outbox + poller) | T2 | `eventbus/*` | unit test: publish→poll→handler dispatched |
| T7 | Transactions module (Saga) | T5,T6 | `modules/transactions/*` | transfer + insufficient-funds + concurrency tests pass |
| T8 | Payments module | T5,T6 | `modules/payments/*` | topup success/failure tests pass |
| T9 | Fraud module | T6,T7,T8 | `modules/fraud/*` | rule tests pass, admin endpoints pass |
| T10 | Notifications module | T6 | `modules/notifications/*` | SES call mocked test passes |
| T11 | Frontend pages + API wiring | T3–T9 | `frontend/*` | manual E2E journeys (Section 9) pass |
| T12 | Security hardening pass | T3–T11 | middleware, headers | rate limit + validation on every route confirmed |
| T13 | CI pipeline | T0 | `.github/workflows/ci-cd.yml` | push triggers test+build |
| T14 | CDK infra + deploy | Document 3 | `infrastructure/cdk/*` | staging environment reachable over HTTPS |

---

## 12. Definition of Done

Implementation is complete when: all tasks T0–T14 pass their completion criteria; all acceptance
criteria in Section 10 (applied to every endpoint) pass; `npm test` is green in CI; the app is
deployed and reachable per Document 3; the handoff checklist in Document 3 Part M is fully checked.

---

## MASTER BUILD INSTRUCTION

Paste the following to an AI coding agent to begin implementation:

> Read Documents 1, 2, and 3 of the AegisBank specification in full before writing any code. Build
> the project exactly as specified: a Node.js/TypeScript/Express/PostgreSQL/React modular monolith
> implementing the Auth/KYC, Account, Transaction, Payment, Fraud Detection, and Notification modules
> as separate, well-bounded code modules communicating through the internal Postgres-outbox event bus
> described in Document 1 §3 and Document 2 §3. Implement the phases in Document 2 §1 strictly in
> order (T0–T14 in §11), and do not begin a phase until the previous phase's acceptance criteria pass.
> Do not invent additional features beyond Document 1 §1–2 scope. Do not introduce Kubernetes, Kafka,
> or any additional AWS services beyond those named in Document 3 without first writing a new
> ARCHITECTURE DECISION explaining the cost/complexity tradeoff. Keep all secrets out of the
> repository — use `.env.example` as the template and real values only via environment/Secrets
> Manager as described in Document 2 §8 and Document 3 Part D. Write unit, integration, and API tests
> for every module as specified in Document 2 §9, and do not mark any task complete until its
> acceptance criteria (GIVEN/WHEN/THEN, Document 2 §10) pass. Follow the security requirements in
> Document 1 §9 for every endpoint you write. Prepare the final repository for deployment exactly as
> described in Document 3, including the CDK infrastructure and GitHub Actions pipeline. If you
> discover an ambiguity or missing detail not covered by these documents, make the most practical,
> lowest-cost, lowest-complexity engineering decision, label it clearly as an ARCHITECTURE DECISION
> with your reasoning, and continue — do not stop implementation to ask unless the project is
> literally unbuildable without the missing information. Update these documents if your implementation
> deviates from them. You are expected to actually write and commit working code, not only describe
> how it would be written.
