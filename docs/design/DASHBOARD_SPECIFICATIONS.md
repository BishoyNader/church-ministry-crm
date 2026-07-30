# Dashboard Specifications — Church Ministry Platform

**Version:** 1.0  
**Route:** `/[locale]/dashboard`  
**Layout:** App Shell with role-differentiated content  

---

## 1. Architecture

### 1.1 Rendering Strategy
- **Page shell:** RSC (server-rendered layout shell)
- **Widgets:** RSC with Suspense boundaries
- **Charts:** Client components (Recharts) wrapped in Suspense
- **Data fetching:** Server Actions or direct DB queries from RSC

### 1.2 Role-Based Content Switching

The dashboard page reads the current user's role from session, then renders the appropriate widget grid:

```
dashboard/page.tsx
├── SuperAdminDashboard (role === 'super_admin' || role === 'platform_owner')
├── AdminDashboard     (role === 'admin')
└── UserDashboard      (role === 'user')
```

Each dashboard variant is a separate component file to keep code clean.

### 1.3 Data Refresh Strategy

| Widget | Refresh | Caching |
|--------|---------|---------|
| All counts | Per-page navigation | RSC data cache (no stale) |
| Attendance rate | Per-page navigation | No cache (fresh every visit) |
| Streak | Per-page navigation | No cache |
| Follow-up reminders | Per-page navigation | No cache |
| Notifications count | Poll every 60s (client) | TanStack Query |

**No real-time sync in MVP.** WebSocket/live updates deferred to Phase 2.

---

## 2. Super Admin Dashboard

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  [locale] Dashboard                          [header]   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Total       │  │  Total       │  │  Attendance  │  │
│  │  Servants    │  │  Beneficiaries│  │  Rate (Week) │  │
│  │    45        │  │    120       │  │    78%       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Pending     │  │  Absence     │  │  Follow-up   │  │
│  │  Approvals   │  │  Alerts      │  │  Completion  │  │
│  │    3         │  │    7         │  │    62%       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Widgets

#### W1 — Total Servants
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM profiles WHERE church_id = ? AND deleted_at IS NULL AND role IN ('servant')` |
| **Permission** | `servants.view` |
| **Display** | Large number + "Active" label + "+X new this month" sub-text |
| **Click** | Navigate to `/[locale]/servants` |
| **Loading** | Large number skeleton (w-20 h-10) |
| **Refresh** | On page load |

#### W2 — Total Beneficiaries
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM beneficiaries WHERE church_id = ? AND deleted_at IS NULL AND status = 'active'` |
| **Permission** | `beneficiaries.view` |
| **Display** | Large number + "Active" label |
| **Click** | Navigate to `/[locale]/beneficiaries` |
| **Loading** | Large number skeleton |

#### W3 — Attendance Rate (Current Week)
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id WHERE s.church_id = ? AND s.session_date >= week_start AND s.session_date <= week_end AND ar.status = 'present'` + total records count |
| **Permission** | `attendance.view` |
| **Display** | Large percentage + "This week" label + trend arrow (up/down vs last week) |
| **Click** | Navigate to `/[locale]/attendance/history` |
| **Note** | 0% if no sessions this week (show "No sessions" instead of 0%) |

#### W4 — Pending Approvals
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM profiles WHERE church_id = ? AND approval_status = 'pending'` |
| **Permission** | `servants.approve` |
| **Display** | Large number + "Pending" label |
| **Click** | Navigate to `/[locale]/servants/pending` |
| **Badge** | Highlighted if > 0 |

#### W5 — Absence Alerts
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM notifications WHERE church_id = ? AND type = 'consecutive_absence' AND is_read = false` |
| **Permission** | `attendance.view` |
| **Display** | Large number + "Alerts" label |
| **Click** | Navigate to `/[locale]/attendance/alerts` |
| **Badge** | Highlighted if > 0 |

#### W6 — Follow-up Completion Rate
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*)::float FROM followups WHERE church_id = ?` |
| **Permission** | `followups.view` |
| **Display** | Large percentage + "Completion rate" label |
| **Click** | Navigate to `/[locale]/followups` |

---

## 3. Admin Dashboard

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  [locale] Dashboard                          [header]   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Attendance  │  │  Beneficiary │  │  Servant     │  │
│  │  by Stage    │  │  Count/Stage │  │  Count/Stage │  │
│  │  Stage A: 85%│  │  Stage A: 45 │  │  Stage A: 8  │  │
│  │  Stage B: 72%│  │  Stage B: 32 │  │  Stage B: 5  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Overdue Follow-ups  │  │   Weekly Attendance     │ │
│  │  • John D. — 3d      │  │   Trend (bar chart)     │ │
│  │  • Mary K. — 5d      │  │   ┌───┐ ┌───┐ ┌───┐   │ │
│  │  • Peter S. — 1d     │  │   │   │ │   │ │   │   │ │
│  │  Total: 12 overdue   │  │   └───┘ └───┘ └───┘   │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Widgets

#### W7 — Attendance Rate by Stage
| Property | Value |
|----------|-------|
| **Data source** | Per-stage attendance rate (same as W3 but grouped by stage_id, filtered to admin's assigned stages) |
| **Permission** | `attendance.view` |
| **Display** | Tiny list: stage name + rate bar. Max 5 stages (overflow: "View all") |
| **Click** | Navigate to stage-specific attendance history |

#### W8 — Beneficiary Count by Stage
| Property | Value |
|----------|-------|
| **Data source** | `SELECT stage_id, COUNT(*) FROM beneficiaries b JOIN beneficiary_assignments ba ON ba.beneficiary_id = b.id WHERE ba.is_current = true AND b.church_id = ? GROUP BY stage_id` |
| **Permission** | `beneficiaries.view` |
| **Display** | List: stage name + count |
| **Click** | Navigate to `/[locale]/beneficiaries?stage={stageId}` |

#### W9 — Servant Count by Stage
| Property | Value |
|----------|-------|
| **Data source** | `SELECT stage_id, COUNT(*) FROM profiles p JOIN servant_stage_assignments ssa ON ssa.servant_id = p.id WHERE ssa.end_date IS NULL AND p.church_id = ? GROUP BY stage_id` |
| **Permission** | `servants.view` |
| **Display** | List: stage name + servant count |
| **Click** | Navigate to `/[locale]/servants?stage={stageId}` |

#### W10 — Overdue Follow-ups
| Property | Value |
|----------|-------|
| **Data source** | `SELECT * FROM followups WHERE church_id = ? AND status = 'open' AND scheduled_at < now() ORDER BY scheduled_at LIMIT 5` |
| **Permission** | `followups.view` |
| **Display** | List of up to 5 items: beneficiary name + days overdue. "View all N overdue" link. |
| **Click** | Navigate to `/[locale]/followups?status=overdue` |

#### W11 — Weekly Attendance Trend
| Property | Value |
|----------|-------|
| **Data source** | Attendance rate per day for the past 7 days (Recharts BarChart) |
| **Permission** | `attendance.view` |
| **Display** | Simple bar chart, 7 bars, day labels, rate labels on hover |
| **Loading** | Skeleton chart (animated bars) |
| **Chart library** | `recharts` BarChart with responsive container |

---

## 4. User Dashboard

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  [locale] Dashboard                          [header]   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  My          │  │  Today's     │  │  Spiritual   │  │
│  │  Beneficiaries│  │  Attendance  │  │  Journal     │  │
│  │    8         │  │  Not yet     │  │  Streak: 5d  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Upcoming Follow-ups (Next 7 Days)                  ││
│  │  ┌──────────────────────────────────────────────────┐││
│  │  │ • Sarah M. — Visit — Tomorrow                   │││
│  │  │ • John D. — Call — In 3 days                    │││
│  │  │ • Mary K. — Visit — In 5 days                   │││
│  │  │ No more follow-ups this week                    │││
│  │  └──────────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │  Overdue Follow-ups                                 ││
│  │  2 overdue — Mark as done                           ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 4.2 Widgets

#### W12 — My Beneficiaries Count
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM beneficiary_assignments WHERE servant_id = ? AND is_current = true` |
| **Permission** | `beneficiaries.view` |
| **Display** | Large number + "Assigned" label |
| **Click** | Navigate to `/[locale]/beneficiaries?servant=me` |
| **Scope** | Current user's servant ID only |

#### W13 — Today's Attendance Status
| Property | Value |
|----------|-------|
| **Data source** | Check if attendance was recorded for user's stage(s) today: if yes → show rate; if no → "Not yet recorded" |
| **Permission** | `attendance.view` |
| **Display** | Status text + CTA button "Record Now" if not recorded |
| **Click** | Navigate to `/[locale]/attendance/record` |

#### W14 — Spiritual Journal Streak
| Property | Value |
|----------|-------|
| **Data source** | Count consecutive days where a spiritual journal entry exists going back from today |
| **Permission** | `spiritual.view_own` |
| **Display** | ✅ icon + "Streak: N days" + "Log today" button (if today not yet logged) |
| **Click** | Navigate to `/[locale]/spiritual` |

#### W15 — Upcoming Follow-ups
| Property | Value |
|----------|-------|
| **Data source** | `SELECT * FROM followups WHERE assigned_to = ? AND scheduled_at BETWEEN now() AND now() + interval '7 days' AND status = 'open' ORDER BY scheduled_at LIMIT 5` |
| **Permission** | `followups.view` |
| **Display** | List of up to 5 items: beneficiary name, type, relative date ("Tomorrow", "In 3 days"). "No more this week" if empty. |
| **Click** | Navigate to `/[locale]/followups` |

#### W16 — Overdue Follow-ups (User)
| Property | Value |
|----------|-------|
| **Data source** | `SELECT COUNT(*) FROM followups WHERE assigned_to = ? AND status = 'open' AND scheduled_at < now()` |
| **Permission** | `followups.view` |
| **Display** | "N overdue — Mark as done" link. Highlighted if > 0. |
| **Click** | Navigate to `/[locale]/followups?status=overdue&assigned=me` |

---

## 5. Implementation Rules

1. **All widget queries** must include `church_id` filter for tenant isolation
2. **Widgets are RSCs** — no client-side data fetching except notifications count
3. **Server Actions** for any widget interaction (mark follow-up done, log journal entry)
4. **Error handling:** individual widget failure shows error state, does not crash page
5. **Loading:** each widget has its own Suspense boundary with skeleton
6. **Charts:** use `recharts` with `ResponsiveContainer`, wrapped in `dynamic(() => import(...), { ssr: false })`
7. **No hardcoded mock data** — all widgets read from real DB
8. **Cache:** no client-side caching beyond RSC data cache
