# PRD V2 → V3 Gap Analysis

**Date:** 2026-07-30  
**Auditor:** Principal Architect  
**Source of truth:** Original business requirements (Product Owner)  

---

## Critical Gaps

### GAP‑1 Spiritual Growth Module Placed in Phase 2

**V2 treatment:** Phase 2 — deferred 3 months after MVP  
**Original requirement:** Spiritual growth tracking is listed as a core platform purpose alongside attendance, follow-ups, and notifications. The detailed daily schedule (Morning Prayer through Spiritual Notes) is specified at the same level of detail as attendance and follow-ups.  
**Severity:** **Critical**  
**Verdict:** Must be MVP.

---

### GAP‑2 Attendance Alerts Deferred to Phase 2

**V2 treatment:** "Consecutive absence alerts" and "missing attendance submissions" in Phase 2  
**Original requirement:** "Generate alerts for: Consecutive absences, Low attendance rates, Missing attendance submissions" — specified as a core attendance feature, not a future enhancement.  
**Severity:** **High**  
**Verdict:** Must be MVP.

---

### GAP‑3 No Role Hierarchy Section

**V2 treatment:** Roles listed in a matrix but no hierarchy, no inheritance rules, no annual change workflow, no service history.  
**Original requirement (task):** Complete Role Hierarchy with Church, Super Admin, Admin, User, permission inheritance, annual role changes, service history tracking.  
**Severity:** **High**  
**Verdict:** Add dedicated section.

---

### GAP‑4 No Data Visibility Matrix

**V2 treatment:** Permission matrix (who can do what) but no visibility matrix (who can see what data).  
**Original requirement (task):** Define exactly who can view servants, beneficiaries, attendance, spiritual records, reports.  
**Severity:** **High**  
**Verdict:** Add dedicated matrix.

---

### GAP‑5 Service Structure Uses Wrong Terminology

**V2 treatment:** "Ministry" as top-level grouping under Church.  
**Original requirement (task):** Church → Service → Stage → Class (if applicable).  
**Severity:** **Medium**  
**Verdict:** Rename and restructure. "Service" is the canonical term (خدمة); "Ministry" is a synonym. Include "Class" as an optional subdivision of Stage.

---

### GAP‑6 No Database Requirements Section

**V2 treatment:** Information architecture diagram only, no formal database requirements.  
**Original requirement (task):** Core entities, relationships, ownership rules, soft delete rules, audit requirements.  
**Severity:** **Critical**  
**Verdict:** Add complete DATABASE_REQUIREMENTS.md.

---

### GAP‑7 No RBAC Architecture Section

**V2 treatment:** Permission matrix inline but no architecture section covering roles, permissions, resource ownership, stage-level access control.  
**Original requirement (task):** Complete RBAC architecture with stage-level control.  
**Severity:** **High**  
**Verdict:** Add complete RBAC_ARCHITECTURE.md.

---

### GAP‑8 Tenant Isolation Under-Specified

**V2 treatment:** Multi-Tenant Requirements section exists but lacks implementation detail.  
**Original requirement:** "Each church is completely isolated from every other church. No church can access another church's data."  
**Severity:** **High**  
**Verdict:** Expand with implementation requirements (RLS, connection pooling, backup isolation, key management).

---

### GAP‑9 MVP Scope Excludes Spiritual Growth

**V2 treatment:** MVP = servant → beneficiary → attendance → follow-up workflow only.  
**Original requirement:** Spiritual growth tracking is a core platform function, documented at the same level as every other feature.  
**Severity:** **Critical**  
**Verdict:** MVP must include Spiritual Growth module. See GAP‑1.

---

## Minor Gaps

### GAP‑10 No Annual Role Change Workflow

V2 does not address the church practice where servant assignments and roles reset or change annually (new service year). The system must support mass reassignment with history.  

**Verdict:** Add to Role Hierarchy and Database Requirements.

---

### GAP‑11 Service History Not Tracked as Entity

V2 mentions "service history" as a servant field but does not define it as a tracked entity with start/end dates, role, and scope.  

**Verdict:** Add `service_assignments` entity with temporal tracking.

---

### GAP‑12 Class Level Not Defined

V2 has Stage but no Class subdivision. In larger churches, a Stage may have multiple parallel classes (e.g., "First Year Intermediate" and "Second Year Intermediate" within the same stage).  

**Verdict:** Add optional Class entity under Stage.

---

### GAP‑13 Parent Contact Fields Incomplete

V2 lists "father mobile" and "mother mobile" but original specifies: "Mobile number, Father mobile, Mother mobile, WhatsApp number". V2 has a generic "mobile" but does not consistently capture all four parent contact fields.  

**Verdict:** Add `father_mobile`, `mother_mobile`, `whatsapp` to beneficiary schema.

---

### GAP‑14 WhatsApp Listed as Future Only

V2 says "WhatsApp integration (future)" but original says "Support: In-app notifications, Email notifications, WhatsApp integration (future)". It should be documented as a planned channel with a timeline, not a maybe.  

**Verdict:** Keep as Phase 2 with committed timeline.

---

### GAP‑15 No Church-Level Configurable Role Permissions Detail

V2 mentions "Configurable role permissions (Priest-level override)" but does not define what can be overridden or the limits of override.  

**Verdict:** Expand in RBAC_ARCHITECTURE.md.

---

## Summary

| # | Gap | Severity | V2 Section | Fix |
|---|-----|----------|------------|-----|
| 1 | Spiritual Growth in Phase 2 | Critical | Phase 2 | Move to MVP |
| 2 | Attendance alerts in Phase 2 | High | Phase 2 | Move to MVP |
| 3 | No Role Hierarchy section | High | Role Matrix | Add dedicated section |
| 4 | No Data Visibility Matrix | High | Permission Matrix | Add dedicated matrix |
| 5 | Wrong service structure term | Medium | Information Architecture | Rename to Service → Stage → Class |
| 6 | No Database Requirements | Critical | Missing | Add DATABASE_REQUIREMENTS.md |
| 7 | No RBAC Architecture | High | Missing | Add RBAC_ARCHITECTURE.md |
| 8 | Tenant isolation under-specified | High | Multi-Tenant | Expand |
| 9 | MVP excludes Spiritual Growth | Critical | MVP Scope | Move to MVP |
| 10 | No annual role change workflow | Medium | Missing | Add to Role Hierarchy |
| 11 | Service history not tracked | Medium | Information Architecture | Add entity |
| 12 | Class level not defined | Low | Information Architecture | Add optional entity |
| 13 | Parent contact fields incomplete | Low | Functional Requirements | Expand fields |
| 14 | WhatsApp commitment unclear | Low | Notification Requirements | Add timeline |
| 15 | Role override limits undefined | Low | Permission Matrix | Expand in RBAC |

---

## Corrective Actions (V3)

1. Spiritual Growth module → **MVP**
2. Attendance alerts → **MVP**
3. Add Role Hierarchy section with inheritance, annual changes, service history
4. Add Data Visibility Matrix
5. Rename "Ministry" to "Service" throughout; add Class level
6. Create DATABASE_REQUIREMENTS.md
7. Create RBAC_ARCHITECTURE.md
8. Expand tenant isolation with implementation detail
9. Re-scope MVP to include Spiritual Growth
10-15. Address all minor gaps in the relevant sections
