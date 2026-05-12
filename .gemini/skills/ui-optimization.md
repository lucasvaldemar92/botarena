---
name: ui-optimization
description: Use this skill for frontend UI tasks. Activates on: "remove button", "UI purge", "dead element", "frontend performance", "CSS fix", "layout issue", "visual adjustment", or any request that modifies the chat or dashboard interface.
---

# Skill: UI Optimization — BotArena

## Stack
- **Frontend:** Vanilla HTML5, CSS3, JavaScript — no frameworks
- **Theme:** WhatsApp Web inspired (dark/light)
- **Files:** `botarena-front/chat.html`, `botarena-front/dashboard.html`, `botarena-front/style.css`

## DOM Purge Policy
Elements removed from BotArena must be **physically deleted** from the DOM:
- Use `element.remove()` — never `display:none` or `visibility:hidden`
- After removal, run `qa_check.py` to confirm element is gone from HTML

### Currently purged elements (must never return)
| Element | Selector | Reason |
|---|---|---|
| Video call button | `.fa-video` | Not supported by whatsapp-web.js |
| Voice call button | `.fa-phone` | Not supported by whatsapp-web.js |

### Protected elements (must never be removed)
| Element | ID/Class | Function |
|---|---|---|
| New conversation button | `new-chat` | Opens contact modal |
| Three-dot menu | `chat-menu` | Settings and actions |
| Send button | `main-send-btn` | Send message |
| Search in chat | `chat-search` | Filter conversations |

## Dynamic DOM Rules
- Elements are destroyed and recreated when switching contacts
- Never store DOM references in module-level variables
- Always use event delegation on `document`
- Follow `dynamic-dom-frontend` global rule on every edit

## Performance Rules
- No external libraries unless strictly necessary — vanilla CSS and JS only
- No inline styles — all styles in `style.css`
- Cache busting: increment `?v=` on every JS/CSS change referenced in HTML
- No `console.log` in production frontend code

## Language Rules
- All user-facing text in Portuguese (PT-BR)
- Placeholders, labels, error messages, tooltips — all in PT-BR
- Run `qa_check.py` UI audit to catch any remaining English text

## Prohibited
- Hiding elements with CSS without removing from DOM
- Adding new external libraries without explicit approval
- Inline styles on any element
- English text visible to the end user