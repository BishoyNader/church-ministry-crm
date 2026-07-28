-- Add audit trigger for followups table
-- Ensures all follow-up create/update/delete operations are logged

DROP TRIGGER IF EXISTS audit_followups ON public.followups;

CREATE TRIGGER audit_followups
AFTER INSERT OR UPDATE OR DELETE
ON public.followups
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_fn();