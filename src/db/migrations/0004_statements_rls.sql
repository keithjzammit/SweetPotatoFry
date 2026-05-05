-- RLS for the statements table.
-- Co-owners read their own statements. Owners read everything (they have the
-- summary view in /tax). Service role inserts via the cron.

ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY statements_self_read ON public.statements
  FOR SELECT USING (co_owner_id = auth.uid());

CREATE POLICY statements_owner_read ON public.statements
  FOR SELECT USING (public.current_role() = 'owner');
