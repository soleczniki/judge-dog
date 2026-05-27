import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return; // no-op in dev / until DSN is configured
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE, // "production" | "development"
    // Only send errors in production
    enabled: import.meta.env.PROD,
    // Sample 100 % of errors, 10 % of performance traces
    tracesSampleRate: 0.1,
    // Attach release info if you add VITE_RELEASE to CI
    release: import.meta.env.VITE_RELEASE ?? undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Replay 5 % of sessions, 100 % of sessions with errors
        sessionSampleRate: 0.05,
        errorSampleRate: 1.0,
        // Never record personal data
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

// Re-export so callers can use Sentry.captureException etc. without a
// direct @sentry/react import in every file.
export { Sentry };
