# Pre-Migration Baseline

**Environment:** Local Supabase instance (staging simulation)  
**Database URL:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`  
**Migrations applied:** 001–006  
**Date:** 2026-07-30  

---

## Schema Summary

| Metric | Value |
|--------|-------|
| Tables | 21 |
| Views | 0 |
| Foreign Keys | 52 |
| Indexes | 77 |
| RLS Policies | 70 |
| Enums | 28 |

## Tables

| # | Table | Row Count | Notes |
|---|-------|-----------|-------|
| 1 | ai_conversations | 0 | |
| 2 | ai_messages | 0 | |
| 3 | attendance | 0 | |
| 4 | audit_logs | 0 | |
| 5 | children | 0 | |
| 6 | churches | 0 | |
| 7 | document_embeddings | 0 | |
| 8 | documents | 0 | |
| 9 | event_registrations | 0 | |
| 10 | events | 0 | |
| 11 | followups | 0 | |
| 12 | ministries | 0 | |
| 13 | notifications | 0 | |
| 14 | permissions | 45 | Seeded by migration 003 |
| 15 | profiles | 0 | |
| 16 | role_permissions | 0 | |
| 17 | roles | 0 | |
| 18 | spiritual_records | 0 | |
| 19 | stages | 0 | |
| 20 | user_roles | 0 | |
| 21 | user_stage_assignments | 0 | |

## Foreign Keys (52)

| Constraint | Table | References |
|-----------|-------|------------|
| ai_conversations_church_id_fkey | ai_conversations | churches |
| ai_conversations_user_id_fkey | ai_conversations | profiles |
| ai_messages_church_id_fkey | ai_messages | churches |
| ai_messages_conversation_id_fkey | ai_messages | ai_conversations |
| attendance_child_id_fkey | attendance | children |
| attendance_church_id_fkey | attendance | churches |
| attendance_recorded_by_fkey | attendance | profiles |
| attendance_stage_id_fkey | attendance | stages |
| audit_logs_church_id_fkey | audit_logs | churches |
| audit_logs_user_id_fkey | audit_logs | profiles |
| children_church_id_fkey | children | churches |
| children_created_by_fkey | children | profiles |
| children_ministry_id_fkey | children | ministries |
| children_stage_id_fkey | children | stages |
| document_embeddings_church_id_fkey | document_embeddings | churches |
| document_embeddings_document_id_fkey | document_embeddings | documents |
| documents_church_id_fkey | documents | churches |
| documents_uploaded_by_fkey | documents | profiles |
| event_registrations_child_id_fkey | event_registrations | children |
| event_registrations_church_id_fkey | event_registrations | churches |
| event_registrations_event_id_fkey | event_registrations | events |
| event_registrations_registered_by_fkey | event_registrations | profiles |
| events_church_id_fkey | events | churches |
| events_created_by_fkey | events | profiles |
| events_ministry_id_fkey | events | ministries |
| events_stage_id_fkey | events | stages |
| followups_assigned_to_fkey | followups | profiles |
| followups_child_id_fkey | followups | children |
| followups_church_id_fkey | followups | churches |
| followups_created_by_fkey | followups | profiles |
| followups_stage_id_fkey | followups | stages |
| ministries_church_id_fkey | ministries | churches |
| notifications_church_id_fkey | notifications | churches |
| notifications_user_id_fkey | notifications | profiles |
| profiles_church_id_fkey | profiles | churches |
| profiles_id_fkey | profiles | auth.users |
| role_permissions_permission_id_fkey | role_permissions | permissions |
| role_permissions_role_id_fkey | role_permissions | roles |
| roles_church_id_fkey | roles | churches |
| spiritual_records_child_id_fkey | spiritual_records | children |
| spiritual_records_church_id_fkey | spiritual_records | churches |
| spiritual_records_recorded_by_fkey | spiritual_records | profiles |
| stages_church_id_fkey | stages | churches |
| stages_ministry_id_fkey | stages | ministries |
| user_roles_assigned_by_fkey | user_roles | profiles |
| user_roles_church_id_fkey | user_roles | churches |
| user_roles_role_id_fkey | user_roles | roles |
| user_roles_user_id_fkey | user_roles | profiles |
| user_stage_assignments_assigned_by_fkey | user_stage_assignments | profiles |
| user_stage_assignments_church_id_fkey | user_stage_assignments | churches |
| user_stage_assignments_stage_id_fkey | user_stage_assignments | stages |
| user_stage_assignments_user_id_fkey | user_stage_assignments | profiles |

## Enums (28)

| Enum | Values |
|------|--------|
| aal_level | aal1, aal2, aal3 |
| action | INSERT, UPDATE, DELETE, TRUNCATE, ERROR |
| ai_message_role | user, assistant, system, tool |
| attendance_status | present, absent, excused |
| audit_action | create, update, delete, login, logout, export, ai_action |
| buckettype | STANDARD, ANALYTICS, VECTOR |
| child_status | active, inactive, transferred, graduated |
| code_challenge_method | s256, plain |
| document_entity_type | child, event, church, user |
| equality_op | eq, neq, lt, lte, gt, gte, in, like, ilike, is, match, imatch, isdistinct |
| event_registration_status | registered, confirmed, cancelled, attended |
| event_type | meeting, camp, conference, trip, other |
| factor_status | unverified, verified |
| factor_type | totp, webauthn, phone |
| followup_status | scheduled, in_progress, completed, cancelled |
| followup_type | phone_call, home_visit, whatsapp, church_meeting, other |
| gender_type | male, female |
| notification_channel | absence_alert, followup_reminder, birthday, event_reminder, system |
| notification_type | in_app, email |
| oauth_authorization_status | pending, approved, denied, expired |
| oauth_client_type | public, confidential |
| oauth_registration_type | dynamic, manual |
| oauth_response_type | code |
| one_time_token_type | confirmation_token, reauthentication_token, recovery_token, email_change_token_new, email_change_token_current, phone_change_token |
| pipeline_stage_type | new_visitor, first_followup, regular_attendee, active_member, leader_candidate |
| request_status | PENDING, SUCCESS, ERROR |
| spiritual_record_type | baptism, confession, communion, prayer, other |
| user_role_type | super_admin, church_admin, stage_leader, servant, viewer |

## RLS Policies (70)

Policies exist on all 21 tables (from migration 002).

## Permissions

45 codes seeded by migration `003_seed_permissions.sql`. Count verified.

---

**Baseline captured. Ready for Phase 2 — Migration Execution.**
