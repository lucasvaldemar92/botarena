// ==========================================
// 🛡️ SENTRY INITIALIZATION (must load first)
// ==========================================
require('dotenv').config();
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

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
