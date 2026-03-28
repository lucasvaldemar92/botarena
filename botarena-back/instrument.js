// ==========================================
// 🛡️ SENTRY INITIALIZATION (must load first)
// ==========================================
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing
  tracesSampleRate: 0.1, // 10% of transactions (Production)

  // Profiling
  profilesSampleRate: 0.1, // 10% of profiles (Production)
});
