# i18n Audit Report — `src/messages/en.json` vs `src/messages/ar.json`

**Project:** Church Ministry CRM
**Audit date:** 2026-08-07
**Files:** `src/messages/en.json`, `src/messages/ar.json`
**Method:** recursive flatten + key diff (Node.js v22), static usage scan of `src/`
**Config:** next-intl — `src/i18n/routing.ts` (`defaultLocale: "ar"`, `locales: ["ar","en"]`),
messages loaded by dynamic import in `src/i18n/request.ts`.

---

## 1. Verdict

| Metric | en.json | ar.json |
|---|---|---|
| Leaf string keys | **1,250** | **1,250** |
| Nested-object nodes | 193 | 193 |
| Keys present in both | **1,250** | **1,250** |
| Keys only in `en` (missing AR translation) | **0** | – |
| Keys only in `ar` | – | **0** |
| Duplicate keys | 0 | 0 |
| Top-level namespaces | 26 | 26 (identical set) |

**EN/AR parity is 100% at the key level.** No English-only strings are missing an
Arabic key, no Arabic-only keys exist, no duplicates, and both files expose the same
26 namespaces. There is **no translation-coverage gap to fix** for the current feature
set.

The only 6 values that are byte-identical across both languages are intentional
(placeholders / example values), not untranslated strings:

- `churches.form.placeholderEmail` → `contact@church.org`
- `churches.form.placeholderLocale` → `ar`
- `churches.form.placeholderSlug` → `church-slug`
- `churches.form.placeholderStatus` → `active`
- `churches.form.placeholderTier` → `trial`
- `services.table.stageCount` → `{count}`

Placeholder coverage is also in sync: 61 ICU placeholders in each file with identical
names and distributions (`{count}` ×26, `{name}` ×18, plus `{imported}`, `{row}`,
`{total}`, `{page}`, `{totalPages}`, `{failed}`, `{email}`, `{date}`, `{reason}`,
`{skipped}`, `{from}`, `{to}`).

## 2. Namespace coverage (en leaf keys)

| Namespace | Keys | | Namespace | Keys |
|---|---|---|---|---|
| churches | 227 | | dashboard | 39 |
| children | 222 | | admin | 32 |
| users | 118 | | settings | 32 |
| audit | 65 | | reports | 28 |
| auth | 65 | | nav | 26 |
| stages | 64 | | spiritualJournal | 21 |
| servants | 57 | | notifications | 11 |
| approvals | 56 | | widgets / home / features / pagination / errorBoundary / notFound / rbac / common | 9/8/6/5/4/3/3/1 |

Both files have identical counts per namespace (delta = 0 in every namespace).

## 3. Dead / unreachable keys (~18% of the catalog)

~224 of 1,250 keys (18%) have no static reference in `src/`. A large share is used
via **dynamic keys** (`t(\`nav.${labelKey}\`)` in `app-shell.tsx`,
`t(\`statusDialog.${status}.*\`)` in `church-status-confirm-dialog.tsx`,
`t(\`actions.${value}\`)` / `t(\`entityTypes.${value}\`)` in `audit-page.tsx`,
`t(\`roleFilter.${value}\`)` in user/servant filters, `t(\`status.${value}\`)` etc.) —
these are NOT dead. The genuinely dead clusters:

1. **`admin.churchRequests` — 29 of 32 keys dead (91%).** The backing page
   (`admin-church-requests-page.tsx:7-23`) is a stub rendering only an empty state;
   `tabs.*`, `table.*`, `search*`, `approveDialog.*`, `rejectDialog.*`, `errors.*`,
   `resultsCount`, `approve`, `reject` are unreachable.
2. **Legacy `children.form.*` and `children.detail.*` field keys (~39 keys)** left over
   from the `firstNameAr/En + lastNameAr/En` → `fullNameAr/fullNameEn` refactor:
   `firstNameAr`, `firstNameEn`, `lastNameAr`, `lastNameEn`, `ministry`,
   `pipelineStage`, `selectMinistry`, `selectPipeline`, `parentPhone`, `parentEmail`,
   `parentAddress`, `fatherName`, `motherName`, `emergencyName`, `emergencyPhone`,
   `allergies`, `medicalConditions`, `medications`, `baptismDate`,
   `confessionFrequency`, `spiritualNotes`, `schoolName`, `gradeLevel`, plus
   `sections.medical/spiritual/education` and detail-page duplicates.
3. **Other orphans:** `children.table.pipelineStage/parentPhone/enrolledAt`,
   `children.filters.allMinistries/allPipeline`, `children.attendance.present/absent/
   excused/saveSuccess/ministryFilter`, `children.errors.*` subset,
   `children.followups.stage/selectStage`, `audit.detail.time`,
   `notifications.markReadError/markAllReadError/unreadCount`, `users.errors.loadFailed`,
   `servants.edit.confessionFatherName`, `stages.errors.loadFailed/stageListFailed`,
   `stages.stage.createFormTitle`, `stages.stage.description`,
   `stages.ministry.status.active`, `stages.stage.status.active`, several bare
   `churches.*` entity labels (`members`, `servants`, `children`, `slug`, `status`,
   `classes.label/emptyState`, `services.label/emptyState`, `stages.label/emptyState`).

**Impact:** dead keys are maintenance debt, not a translation defect — they exist in
**both** languages, so removing them is a cleanup win (no AR gap is created).

## 4. Recently added surface (working tree)

`en.json`/`ar.json` both carry +173 line changes (uncommitted). The added keys are
already mirrored 1:1 — parity held even mid-sprint. `users.roleFilter.stageManager`
already exists in both languages for the Stage Manager role.

## 5. Recommendations

1. **Coverage: no action required** — parity is perfect; next-intl will never hit a
   missing-key path in either locale.
2. **New Stage Manager UI must add keys in pairs** (en + ar together) to preserve the
   invariant. Planned additions (see `STAGE_MANAGER_IMPLEMENTATION_PLAN.md` §3.4):
   `stages.scope.*`, `reports.scope.notice`, `children.filters.myStages`,
   `servants.filters.myStages`, `rbac.roles.stageManager`.
3. **Cleanup (optional, non-blocking):** prune the dead clusters above from both files
   in one commit — biggest win is `admin.churchRequests` (29 keys) and the legacy
   `children.*` fields (~39 keys). Do this **only after** the church-requests admin UI
   is either built or cut.
4. **Guardrail:** add a CI check that fails on `en`/`ar` key-set divergence (the
   flatten-diff used here, ~20 lines) to keep 100% parity enforceable.

---

*Artifacts used for this audit were generated in `/tmp/opencode/` (no files written to
the repository).*
