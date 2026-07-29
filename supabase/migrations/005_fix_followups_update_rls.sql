-- Fix followups_update RLS policy WITH CHECK clause
-- Previously WITH CHECK only enforced church_id, allowing a user who could
-- see a followup to move it to a stage they have no access to.
-- Now WITH CHECK enforces the same permission and stage-access rules as USING.

DROP POLICY IF EXISTS "followups_update" ON public.followups;

CREATE POLICY "followups_update"
  ON followups FOR UPDATE TO authenticated
  USING (
    church_id = get_user_church_id() AND user_has_permission('followups.update')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id) OR assigned_to = auth.uid())
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_has_permission('followups.update')
    AND (user_is_church_admin_or_above() OR user_has_stage_access(stage_id) OR assigned_to = auth.uid())
  );
