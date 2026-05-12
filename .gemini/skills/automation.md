---
name: automation-playwright
description: Use this skill for E2E testing tasks. Activates on: "run e2e tests", "playwright", "visual test", "test QR scan", "test message flow", or any request to validate UI behavior end-to-end.
---

# Skill: Automation — Playwright

## Test Suite Location
- Tests: `botarena-back/tests/`
- Tool: Playwright
- Run: `npm run teste-e2e`

## Required Setup Before Running
Always execute before any test run:
```bash
node execution/ci_setup_db.js
```

## Critical Flows to Test
| Flow | File | Trigger |
|---|---|---|
| QR Code scan | `visual_sync.spec.js` | Bot connection |
| Send message | `visual_sync.spec.js` | Operator action |
| Business hours config | `visual_sync.spec.js` | Settings modal |

## Execution Rules
- Never run E2E on `feat/` or `fix/` branches — local only or on demand
- E2E is triggered manually: `npm run teste-e2e`
- CI pipeline does NOT run E2E automatically — see `ci-fast.yml` and `ci-full.yml`
- Screenshots saved to `qa-evidence/`

## Prohibited
- Running E2E without `ci_setup_db.js` first
- Using E2E as proof of completion — use `git diff --stat` instead