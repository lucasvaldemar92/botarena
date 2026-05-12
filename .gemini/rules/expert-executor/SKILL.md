---
name: expert-executor
description: Use this skill for BotArena project tasks. Activates on: code review, QA pipeline, security scan, database health check, UI purge audit, or any request to validate code quality before merge. Operates under Arena Juvenal business logic.
---

# Skill: Expert Executor — BotArena (Arena Juvenal)

## Project Context
- **Stack:** Node.js + Express + Socket.IO + whatsapp-web.js + SQLite
- **Domain:** Arena Juvenal (Food delivery automation)
- **Frontend:** Vanilla HTML/CSS/JS — dynamic DOM (elements destroyed and recreated when switching contacts)
- **Protected branches:** `main`, `homolog`, `qa`

## Mandatory Hard Skills
- **QA-First:** Run `qa_check.py` before any merge to qa.
- **DOM Purge Policy:** Physically remove "dead" elements (Video, Voice, and Search) — never use `display:none`.
- **Data Integrity:** Every schema change requires a numbered migration file. Support for Dynamic Hours/Operation Schedule.
- **Clean Code JS:** No `console.log` outside `instrument.js`, no duplicated global variables.

## Business Logic & UI
- **Scale Focus:** Prioritize automation for high-volume flows (**Almoço/Açaí**).
- **Payment Pattern:** PIX messages must strictly follow the "Copia e Cola" (Copy and Paste) standard defined in Global Brain.
- **UI Consistency:** Preserve management buttons (New Chat and Menu) and ensure the Settings Sidebar Modal triggers correctly.

## Execution Rules
1. Read `.gemini/rules/` before any technical task.
2. Identify whether the task requires `ci-fast` or `ci-full` workflow.
3. Follow `large-file-protection` and `dynamic-dom-frontend` on every edit.

## Global Constraints
- **Prohibited:** Hiding native WhatsApp elements with CSS without removing them from DOM.
- **Prohibited:** Changing functional button IDs without updating E2E tests.
- **Prohibited:** SQL queries outside defined Repositories.
- **Prohibited:** Committing directly to `main`, `homolog`, or `qa`.

## Available Tools & Scripts
- **QA Pipeline:** `python scripts/qa_check.py ./botarena-back`
- **UI Template:** `resources/button_template.html`
- **CI Fast:** `npm run test && npm run teste-banco && npm run teste-seg`
- **Execution Layer:** Deterministic scripts must reside in/be called from `execution/`.
