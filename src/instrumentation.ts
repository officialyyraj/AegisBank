// src/instrumentation.ts — Next.js instrumentation hook.
//
// NOTE: we deliberately do NOT register event handlers or start the outbox
// poller here. Next.js dev (Turbopack) loads this file's relative imports as
// SEPARATE module instances from the app's `@/`-aliased imports, which would
// create two `handlers` Maps and two pollers — the poller would dispatch
// against an empty map (event.no-handler bug). Instead, handler registration
// + poller start happen via `ensureBooted()` in `src/lib/guard.ts` (called on
// every protected route) and in the public selftest route — both using the
// single consistent `@/`-aliased module instance.
export async function register() {
  // Intentional no-op for the event bus. (Future cross-cutting boot hooks
  // like OpenTelemetry could go here.)
}
