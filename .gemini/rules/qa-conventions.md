# QA Conventions — BotArena

## UI Purge Policy
- "Video Call" and "Voice Call" buttons must be physically REMOVED from the DOM — never hidden with CSS
- "New Conversation", "Main Menu" and "Chat Search" buttons must be preserved for admin management and history

## Database
- Always run `execution/ci_setup_db.js` before any test suite to ensure SQLite integrity

## CI/CD
- Production deploys (main) require `ci-full.yml` approval