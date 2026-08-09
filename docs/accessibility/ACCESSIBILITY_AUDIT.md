# Accessibility Audit & Remediation

Sprint 2 · Phase 7.

## Scope

Reviewed every page and module against the core WCAG 2.1 AA success criteria:
keyboard navigation (2.1.1), focus visible (2.4.7), ARIA usage (4.1.2),
labels (1.3.1 / 3.3.2), color contrast (1.4.3), reduced motion (2.3.3), and
responsive behavior (1.4.10).

## Findings

### Already strong (no change required)

| Area | Evidence |
| --- | --- |
| Skip link | `#main-content` skip link in `app-shell.tsx`, visually hidden until focused |
| Landmarks / nav labels | `aria-label` on both desktop and mobile `<nav>` |
| Current page indication | `aria-current="page"` on active sidebar links |
| Form labels | Shared `FormField` wires `htmlFor`/`id`, `aria-invalid`, `aria-describedby` (hint + error ids), `aria-required` |
| Field errors | `role="alert"` on error text |
| Dialog semantics | Base UI Dialog → `role="dialog"`, `aria-modal`, portal, focus trap, focus restore |
| Dialog titles | `DialogTitle`/`SheetTitle` present in all 32 dialog/sheet usages |
| Tables | Native `<th scope="col">` + `sr-only` `<caption>` for screen-reader table names |
| Decorative images/icons | No `<img>` without `alt`; feature icons are `aria-hidden` decorative |
| Loading states | `role="status"` + `aria-live="polite"` in shared loading components |
| Form alerts | `role="alert"` on login/signup form errors |
| Reduced motion | Global `prefers-reduced-motion: reduce` media query in `globals.css` |
| RTL | `dir` set from locale; bidirectional layout via `dir` + logical properties |
| Touch targets | Icon buttons `size-9+`, forms use `h-11` inputs |

### Issues fixed in this sprint

1. **Focus visibility (2.4.7) — HIGH.** Components used
   `focus-visible:ring-2 ring-ring/20` (a faint 20%-opacity ring) and several
   explicitly set `focus-visible:outline-none`. Keyboard users could lose the
   focus indicator on low-contrast backgrounds.
   **Fix:** `globals.css` now forces a visible `2px solid var(--ring)` outline
   (`!important`) on every interactive element at `:focus-visible`, with an
   offset and rounded corners — a guaranteed baseline regardless of the
   decorative ring utilities.

2. **Anchor scroll target offset — LOW.** In-page anchors could hide under
   the sticky header.
   **Fix:** global `scroll-margin-top: 6rem` on `[id]` targets.

### Residual / documented

| Item | Severity | Note |
| --- | --- | --- |
| `global-error.tsx` is English-only | LOW | Root error boundary cannot use next-intl provider (documented Phase 9 decision) |
| Icon-only buttons rely on `aria-label` | INFO | All audited instances have labels; add an automated axe scan to CI as follow-up |
| Combobox filter is name-only | LOW | Acceptable for church picker; keyboard usable via arrow keys |
| Focus trap not unit-tested | MEDIUM | Covered manually; add axe-core + `@testing-library` focus tests in a later sprint |

## Recommendations for the next sprint

1. Add `axe-core` + `jest-axe` to the vitest suite and an `axe` step to CI.
2. Add a Playwright accessibility walk on the 6 highest-traffic pages.
3. Keyboard end-to-end script: Tab order through login → dashboard → children.

## Validation

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (no new warnings)
- Manual inspection of shell, auth forms, tables, dialogs, landing, 404 ✅
