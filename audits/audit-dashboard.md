# Dashboard Package Audit — Architecture & Production-Grade UI Standards
**Date:** 2026-08-11  
**Scope:** `packages/dashboard` vs `Plan/Architecture.md`, `Plan/FULL_PRODUCTION_READINESS_AUDIT_2026-08-11.md`, `Plan/ProductionReadiness-2026-08-11.md`, and production-grade UI standards (OWASP ASVS, WCAG 2.1/2.2, secure-by-default web patterns).  
**Status:** Functional prototype — **not production-grade** for public/external use without remediation.

---

## 1. Architecture Plan Alignment

| Plan Requirement | Code Reality | Severity | File:Line |
|------------------|--------------|----------|-----------|
| Dashboard is phase 6 feature: virtual office surface for campaign/session/task visualization | Implemented as static HTML + meta-refresh live view | ✅ Aligned | `packages/dashboard/src/generator.ts:210-229`, `live.ts:355-385` |
| Public API: `renderHtml`, `renderLiveHtml`, `loadCampaign`, `listCampaigns`, `SessionState` types | Implemented and re-exported via barrel | ✅ Aligned | `packages/dashboard/src/index.ts:1-2`, `generator.ts:34-111`, `live.ts:180-190` |
| Package is part of TypeScript monorepo with public API | Private package, strict TS config, barrel exports | ✅ Aligned | `packages/dashboard/package.json:1-22`, `tsconfig.json:1-9` |
| Production-grade: strict mode, type-safe, test coverage | Strict TS enabled; tests exist; coverage gated at 80% | ⚠️ Partial | `vitest.config.ts:1-27` |

---

## 2. Security Findings (Production-Grade UI Standards)

### 2.1 Cross-Site Scripting (XSS) — HIGH
- **Finding:** `campaignsJson` is embedded into HTML via template literal without escaping.
- **Impact:** If `campaign.goal` or any campaign field contains `<script>` or HTML, it executes in the user's browser.
- **Fix:** HTML-escape all user-derived strings before embedding in HTML, or use a safe DOM-building approach. Alternatively, serve JSON separately and build DOM with `DOMPurify` or framework escaping.
- **File:Line:** `packages/dashboard/src/generator.ts:211-228`

### 2.2 XSS via `generatedAt` — HIGH
- **Finding:** `view.generatedAt.toISOString()` is interpolated into a JavaScript string literal inside HTML. If the ISO string were manipulated, it could break out of the string context. While `toISOString()` is deterministic, the pattern of interpolating data directly into `<script>` blocks is unsafe by design.
- **Fix:** Serialize data as JSON with `JSON.stringify` and avoid inline script blocks where possible.
- **File:Line:** `packages/dashboard/src/generator.ts:222-225`

### 2.3 XSS in Live View JSON — HIGH
- **Finding:** `dataJson` in `renderLiveHtml` is interpolated into `<script>` after escaping `<` to `\u003c`. This is insufficient — quotes, backslashes, and other characters are not escaped, allowing attribute/context breakout.
- **Fix:** Use a proper JSON-in-HTML serializer. At minimum, escape `\`, `'`, `"`, and line terminators. Best practice: move data to a `<script type="application/json">` block or use DOM APIs.
- **File:Line:** `packages/dashboard/src/live.ts:359-381`

### 2.4 Content Security Policy (CSP) Missing — MEDIUM
- **Finding:** Generated HTML pages have no CSP headers or `<meta>` CSP. Inline `<style>` and `<script>` blocks would be blocked by a strict CSP, meaning the dashboard cannot adopt modern CSP without refactoring.
- **Fix:** Either inline all code/styles into nonces/hashes (expensive), or move styles/scripts to external files. For a production UI, prefer external assets with strict CSP.
- **File:Line:** `packages/dashboard/src/generator.ts:212-228`, `live.ts:368-384`

### 2.5 Auto-Refresh Without User Control — LOW
- **Finding:** Live view auto-refreshes every 5 seconds via `<meta http-equiv="refresh">` and `setInterval` without a pause/stop control. This can cause unexpected CPU/battery usage and disorientation.
- **Fix:** Add a pause/resume button and respect `prefers-reduced-motion` media query.
- **File:Line:** `packages/dashboard/src/live.ts:6`, `live.ts:373`, `live.ts:341-346`

### 2.6 No Input Validation on Campaign Data — MEDIUM
- **Finding:** `loadCampaign` parses arbitrary JSON with `JSON.parse` and casts with `as`. No schema validation; malformed data causes uncaught exceptions or silent `undefined` values rendered to UI.
- **Fix:** Validate parsed JSON against a Zod schema or TypeScript interface with runtime guards before rendering.
- **File:Line:** `packages/dashboard/src/generator.ts:41-54`

---

## 3. Accessibility (WCAG 2.1/2.2)

### 3.1 Missing Language and Accessibility Metadata — MEDIUM
- **Finding:** HTML uses `<html lang="en">` hardcoded. No `lang` attribute reflects user locale. No `aria-*` landmarks, skip links, or ARIA live regions for dynamically refreshing content.
- **Fix:** Add `lang` from config/campaign, add `role="main"` / `<main>`, skip-to-content link, and `aria-live="polite"` for the live refresh region.
- **File:Line:** `packages/dashboard/src/generator.ts:213`, `live.ts:369`

### 3.2 Color Contrast Unverified — MEDIUM
- **Finding:** CSS custom properties define a dark theme but no contrast ratios are documented or tested. The `--muted: #94a3b8` on `--bg: #0f172a` may not meet WCAG AA (4.5:1 for normal text).
- **Fix:** Audit all color pairs against WCAG 2.1 AA. Use tooling like `axe` or `color-contrast-checker`.
- **File:Line:** `packages/dashboard/src/generator.ts:114-127`, `live.ts:200-213`

### 3.3 Focus Management and Keyboard Navigation — LOW
- **Finding:** Cards and sessions are interactive-looking divs with no `tabindex`, no keyboard handlers, and no focus indicators. If clickable, they violate keyboard accessibility.
- **Fix:** Add `tabindex="0"`, visible `:focus-visible` styles, and Enter/Space key handlers, or make them non-interactive if they are display-only.
- **File:Line:** `packages/dashboard/src/generator.ts:138`, `live.ts:229`

### 3.4 Semantic HTML — LOW
- **Finding:** Uses `<header>`, `<footer>`, `<section>`, `<article>`, which is good, but `<div id="app">` is the root with no landmark roles, and no `<main>` element.
- **Fix:** Wrap app root in `<main>` or add `role="main"`.
- **File:Line:** `packages/dashboard/src/generator.ts:221`, `live.ts:378`

---

## 4. Error Handling & Robustness

### 4.1 Silent Catch Blocks — MEDIUM
- **Finding:** `loadSession` and `loadLiveCampaign` use empty `catch` blocks, silently dropping malformed sessions and hiding errors from operators.
- **Fix:** Log errors with context (session ID, path) and consider a degraded rendering mode (e.g., "session failed to load") rather than silent omission.
- **File:Line:** `packages/dashboard/src/live.ts:135-137`, `live.ts:150-152`

### 4.2 Unhandled JSON Parse Errors — MEDIUM
- **Finding:** `loadCampaign` throws on missing file but `JSON.parse` on valid paths is unguarded; corrupted JSON crashes the entire dashboard generation.
- **Fix:** Wrap `JSON.parse` in try/catch with a structured error and fallback to an error state in the UI.
- **File:Line:** `packages/dashboard/src/generator.ts:41-45`

### 4.3 No Error Boundary / Fallback UI — LOW
- **Finding:** If any single campaign or session fails, the whole live view can fail or silently omit data. No error boundary or "partial failure" rendering exists.
- **Fix:** Render partial results with explicit error messages for failed items.
- **File:Line:** `packages/dashboard/src/live.ts:145-174`

---

## 5. Performance & Backpressure

### 5.1 Busy-Wait / Polling Architecture — MEDIUM
- **Finding:** Live view relies on full page reload via `<meta refresh>` every 5 seconds. This is not scalable and causes unnecessary network/CPU load. No WebSocket/SSE/EventSource implementation exists.
- **Fix:** For production, implement `EventSource` or WebSocket for incremental updates, or at minimum provide a manual refresh button and respect `prefers-reduced-data`.
- **File:Line:** `packages/dashboard/src/live.ts:6`, `live.ts:373`

### 5.2 Unbounded Session/Task Rendering — LOW
- **Finding:** No virtualization or pagination. A campaign with hundreds of sessions will render all DOM nodes at once.
- **Fix:** Add virtual scrolling or pagination for large campaigns.
- **File:Line:** `packages/dashboard/src/live.ts:307-330`

### 5.3 Synchronous I/O Blocking — LOW
- **Finding:** All filesystem access uses synchronous `readFileSync`/`readdirSync`/`statSync`. For a server-rendered dashboard this is acceptable, but if extended to a long-running server, it blocks the event loop.
- **Fix:** Document that this package is static-render-only, or migrate to async I/O if used in a server context.
- **File:Line:** `packages/dashboard/src/generator.ts:1-3`, `generator.ts:62-73`, `live.ts:1-2`

---

## 6. Testing & Coverage

### 6.1 Test Coverage Exists but Gaps Remain — MEDIUM
- **Finding:** Three test files cover happy paths and basic rendering, but no tests exist for:
  - XSS payloads in campaign fields
  - Malformed/corrupted JSON
  - Empty/null fields in session records
  - `renderLiveHtml` with large datasets
  - Accessibility assertions (axe-core)
- **Fix:** Add negative-path tests, security regression tests, and accessibility smoke tests.
- **File:Line:** `test/dashboard.test.ts:1-53`, `test/dashboard-live.test.ts:1-217`, `test/coverage-dashboard.test.ts:1-102`

### 6.2 No Visual Regression / Screenshot Tests — LOW
- **Finding:** No visual regression tests for the generated HTML/CSS. Theme changes could break layout silently.
- **Fix:** Add Playwright or Vitest browser snapshot tests for critical views.
- **File:Line:** N/A — missing artifact

---

## 7. Production-Grade UI Standards Checklist

| Standard | Requirement | Status | Evidence |
|----------|-------------|--------|----------|
| **OWASP ASVS V5** | Output encoding to prevent XSS | ❌ Failing | `generator.ts:211-228`, `live.ts:359-381` |
| **OWASP ASVS V5** | Content Security Policy | ❌ Missing | No CSP in generated HTML |
| **WCAG 2.1 AA** | Text contrast ≥ 4.5:1 | ⚠️ Unverified | `generator.ts:114-127`, `live.ts:200-213` |
| **WCAG 2.1 AA** | Keyboard navigable | ❌ Failing | No `tabindex`, no keyboard handlers |
| **WCAG 2.1 AA** | Landmarks and skip links | ⚠️ Partial | `<header>`/`<footer>` present, no `<main>`/skip link |
| **WCAG 2.1 AA** | Language attribute | ⚠️ Partial | Hardcoded `en` |
| **Secure defaults** | No inline scripts/styles if CSP strict | ❌ Failing | All CSS/JS inline |
| **Resilience** | Graceful degradation on partial data | ⚠️ Partial | Silent omission, no error UI |
| **Observability** | Error telemetry in rendered output | ❌ Missing | No console/error logging in UI |

---

## 8. Prioritized Fixes

### P0 — Security (Must Fix Before Exposure)

| # | Action | File:Line | Effort |
|---|--------|-----------|--------|
| 1 | Escape all user-derived strings before HTML embedding | `generator.ts:211-228` | Small |
| 2 | Fix JSON-in-script escaping for live view data | `live.ts:359-381` | Small |
| 3 | Add runtime schema validation for campaign/session JSON | `generator.ts:41-54`, `live.ts:113-138` | Medium |

### P1 — Production Hardening

| # | Action | File:Line | Effort |
|---|--------|-----------|--------|
| 4 | Add CSP or migrate to external assets | `generator.ts`, `live.ts` | Medium |
| 5 | Replace meta-refresh with EventSource/WebSocket | `live.ts:6`, `live.ts:373` | Medium |
| 6 | Add WCAG AA contrast audit and fixes | `generator.ts:114-127`, `live.ts:200-213` | Small |
| 7 | Add ARIA landmarks, skip links, `lang` support | `generator.ts`, `live.ts` | Small |
| 8 | Replace silent catch blocks with logged error states | `live.ts:135-152` | Small |
| 9 | Add XSS and malformed-input regression tests | `test/dashboard*.ts` | Medium |

### P2 — Polish

| # | Action | File:Line | Effort |
|---|--------|-----------|--------|
| 10 | Add keyboard navigation and focus indicators | `generator.ts`, `live.ts` | Small |
| 11 | Add visual regression / axe-core accessibility tests | new files | Medium |
| 12 | Document that dashboard is static-render-only or migrate to async I/O | README, `generator.ts` | Small |

---

## 9. Evidence Summary

- `packages/dashboard/src/generator.ts:211-228` — unescaped JSON in HTML
- `packages/dashboard/src/live.ts:359-381` — partial JSON escaping in inline script
- `packages/dashboard/src/generator.ts:41-54` — unvalidated `JSON.parse`
- `packages/dashboard/src/live.ts:135-152` — silent error suppression
- `packages/dashboard/src/live.ts:373` — meta-refresh polling
- `test/dashboard.test.ts`, `test/dashboard-live.test.ts`, `test/coverage-dashboard.test.ts` — no security/accessibility tests

---

*Audit performed against Plan/Architecture.md, Plan/FULL_PRODUCTION_READINESS_AUDIT_2026-08-11.md, Plan/ProductionReadiness-2026-08-11.md, and production-grade UI standards (OWASP ASVS, WCAG 2.1/2.2). No files were modified.*
