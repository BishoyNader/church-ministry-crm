# Translation Audit & Remediation

Sprint 2 · Phase 9.

## Summary

The en/ar message sets were already in exact key parity (a strong baseline),
but static analysis revealed **real gaps** the parity check cannot see:

- **46 missing translation keys** referenced by components but absent from both
  files — next-intl renders the raw key string when these are hit (visible
  "key.text" artifacts in the UI).
- **1 component with fully hardcoded English** (church form dialog) and **6
  hardcoded attributes**.
- **Dead dynamic translation usage** in the dashboard (rendered an empty label
  because the underlying DB column was dropped in migration 013).

All gaps are fixed in this sprint, and a **CI gate** (`npm run check:i18n`) now
prevents regressions.

## Findings

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | 46 missing keys across 16 namespaces (approvals, audit, auth, children ×7, churches, classes, dashboard, importExport, servants, services, stages, users) | HIGH | Added to `en.json` + `ar.json` with consistent terminology |
| 2 | `church-form-dialog.tsx` was entirely hardcoded English (labels, placeholders, titles, buttons) | HIGH | New `churches.form` namespace (26 keys × 2 locales) + component rewired to `useTranslations` |
| 3 | 6 hardcoded `placeholder` attributes in church form | MEDIUM | Folded into `churches.form.placeholder*` keys |
| 4 | Dashboard `recent-children` rendered `t(\`pipeline.${stage}\`)` — stage column dropped in migration 013, value always `""` | MEDIUM | Removed dead badge + `pipelineStage` UI field (service no longer populates it) |
| 5 | No automated guard against missing keys / hardcoded strings | HIGH | New `scripts/check-i18n.mjs` + `npm run check:i18n` + CI step |
| 6 | `global-error.tsx` (root boundary, above next-intl provider) was English-only | MEDIUM | Bilingual EN/AR fatal screen driven by `document.documentElement.lang` (via `useSyncExternalStore`) |
| 7 | Sheet close button `sr-only` label hardcoded "Close" | LOW | New shared `common.close` key |

## What was added

- **`scripts/check-i18n.mjs`** — verifies:
  1. en/ar flat-key parity,
  2. every statically referenced key exists in both locales (namespace-aware,
     handles `useTranslations`, `getTranslations("ns")` and the
     `getTranslations({ locale, namespace })` object form, plus template-literal
     prefixes),
  3. no hardcoded English `placeholder`/`aria-label`/`title`/`alt` attributes.
  Exit code 1 on any violation.
- **`tests/unit/i18n-parity.test.ts`** — extended with a technical-placeholder
  allowlist for the new `churches.form.placeholder*` values.
- **`src/lib/client-error.ts`** + monitoring endpoint used by the bilingual
  error boundary (error reporting, Phase 6).

## Key counts

| Metric | Before | After |
| --- | --- | --- |
| en keys | 1,175 | 1,250 |
| ar keys | 1,175 | 1,250 |
| en/ar parity | exact | exact |
| Missing referenced keys | 46 | 0 |
| Hardcoded attributes | 6 | 0 |

## Validation

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (8 pre-existing React Compiler warnings, 0 errors)
- `npm run test` ✅ 54/54 (incl. parity suite)
- `npm run check:i18n` ✅ (`✓ en/ar parity OK · ✓ all referenced keys exist · ✓ no hardcoded attributes`)

## Notes for translators

- `churches.form.placeholderSlug/Email/Phone/Tier/Status/Locale` are technical
  literals (`church-slug`, `contact@church.org`, enum values) intentionally
  identical in both locales — they are inputs, not copy.
- New `common.close` and `pagination.*` keys are shared across features;
  edit once, used everywhere.
