// ==========================================
// 🛡️ SENTRY BROWSER INITIALIZATION
// ==========================================
// Loaded after the Sentry CDN bundle in <head>.
// Shared by dashboard.html and chat.html.
// DSN is injected by the server via window.__SENTRY_DSN__.

Sentry.init({
  dsn: window.__SENTRY_DSN__ || "",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,              // 10% — Production
  replaysSessionSampleRate: 0.1,      // 10% Session Replay in Production
  replaysOnErrorSampleRate: 1.0,      // Always replay on errors
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
});
