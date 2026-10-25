# AegisBank

AegisBank is a full-stack digital banking application for managing accounts, transfers, account funding, payees, scheduled payments, identity verification, notifications, and fraud review.

## Technology

- Next.js 16 with TypeScript and client-side banking views
- Prisma ORM with PostgreSQL for local and deployed environments
- JWT access tokens with database-backed refresh-token rotation and revocation
- Zod request validation, structured JSON logging, rate limiting, and security headers
- Transactional outbox processing for fraud and notification events
- Private filesystem storage for KYC documents, served only through an authenticated route

The application is organized into domain modules under `src/modules/`. Each module keeps its service logic, repository access, and validators together. API handlers live under `src/app/api/v1/`.

## Run locally

```bash
npm install
cp .env.example .env
npm run db:migrate:deploy
npm run dev
```

The application is available at `http://localhost:3000`. Seed data can be loaded with `npm run db:seed` when a local demo environment is needed. The sign-in screen includes sample customer and administrator buttons for quick demo access.

## Configuration

Use `.env.example` as the starting point for local configuration. Production must provide strong, unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; the application refuses to start when those secrets are missing or too weak. Configure `KYC_UPLOAD_DIR` outside the public web root. `CORS_ORIGIN` is an explicit comma-separated allowlist; same-origin browser requests work without setting it.

## Money movement

Transfer and account-funding requests require an `Idempotency-Key` header. The browser API client generates a stable key for each user action, and the server stores a request hash and completed response per user and operation. Retrying the same request returns the original response without moving money twice; reusing a key with a different payload is rejected.

The account ledger update and its event-outbox record are committed together. A background poller retries transient event-handler failures and records exhausted events for operational review. `GET /api/v1/health` performs a database probe and includes outbox counts.

## API conventions

Protected routes require `Authorization: Bearer <access token>`. Administrator routes additionally require an administrator role. Errors use the consistent `{ error, message, details? }` envelope. KYC file access is authenticated and authorized for the document owner or an administrator; uploaded files are not public assets.

The development-only `GET /api/v1/selftest` endpoint exercises service-layer behavior against throwaway records and is unavailable in production. It is not included in the customer navigation.

## Security notes

- Password reset tokens are hashed at rest, single-use, short-lived, and never returned in API responses.
- Refresh tokens are rotated and revoked server-side; sign-out revokes all active refresh sessions.
- Login failures use durable account lockout/backoff state.
- Client IP handling trusts forwarding headers only when `TRUST_PROXY=true`.
- Local databases, environment files, private KYC storage, logs, and generated QA artifacts are ignored by Git.

## Checks

For the complete Render setup, see [`docs/render-deployment.md`](docs/render-deployment.md).

```bash
npm run lint
npx tsc --noEmit
npm run db:migrate:deploy
```

The repository currently contains unrelated legacy lint/type failures in optional infrastructure examples and several existing React effect-rule checks; these are reported by the commands above and are not hidden by the build configuration.
