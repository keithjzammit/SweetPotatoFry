-- Row Level Security policies enforcing the role matrix in spec §3.
-- Policies use auth.uid() (Supabase) to identify the current user.
--
-- Defence-in-depth: server-side code in src/auth/server.ts ALSO validates
-- role + property access. RLS is the safety net.

-- =========================================================================
-- Helpers
-- =========================================================================

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of_property(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_id AND p.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_co_owner_of_property(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ownership_splits os
    WHERE os.user_id = auth.uid()
      AND (os.property_id = p_id OR os.property_id IS NULL)
  );
$$;

-- Manager has access while their lease is active (end_date IS NULL or future).
CREATE OR REPLACE FUNCTION public.is_active_manager_of_property(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.property_id = p_id
      AND l.manager_id = auth.uid()
      AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_property_access(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_owner_of_property(p_id)
    OR public.is_co_owner_of_property(p_id)
    OR public.is_active_manager_of_property(p_id);
$$;

-- =========================================================================
-- Enable RLS on all tables
-- =========================================================================

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_splits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_elections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs  ENABLE ROW LEVEL SECURITY;
-- Reference tables: read by everyone signed in.
ALTER TABLE public.maltese_localities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebate_bands        ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- users: each user reads their own row; owners can read users they invited
-- (so the People screen works). Updates only to self.
-- =========================================================================

CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_owner_read_team ON public.users
  FOR SELECT USING (
    public.current_role() = 'owner'
    AND (
      role = 'co_owner'
      OR role = 'manager'
    )
  );

CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- INSERT happens via service role on first sign-in (handled in src/auth).

-- =========================================================================
-- maltese_localities + rebate_bands: read-only reference tables
-- =========================================================================

CREATE POLICY localities_read ON public.maltese_localities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY rebate_bands_read ON public.rebate_bands
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =========================================================================
-- properties
--   Owner: full CRUD on rows where owner_id = auth.uid()
--   Co-owner: SELECT where they hold a split
--   Manager: SELECT where they have an active lease
-- =========================================================================

CREATE POLICY properties_owner_all ON public.properties
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY properties_co_owner_read ON public.properties
  FOR SELECT USING (public.is_co_owner_of_property(id));

CREATE POLICY properties_manager_read ON public.properties
  FOR SELECT USING (public.is_active_manager_of_property(id));

-- =========================================================================
-- ownership_splits: only owner mutates; co-owner sees own rows
-- =========================================================================

CREATE POLICY splits_owner_all ON public.ownership_splits
  FOR ALL USING (
    property_id IS NULL
      AND public.current_role() = 'owner'
    OR public.is_owner_of_property(property_id)
  )
  WITH CHECK (
    property_id IS NULL
      AND public.current_role() = 'owner'
    OR public.is_owner_of_property(property_id)
  );

CREATE POLICY splits_self_read ON public.ownership_splits
  FOR SELECT USING (user_id = auth.uid());

-- =========================================================================
-- leases
--   Owner: full CRUD on properties they own
--   Manager: SELECT their own leases
-- =========================================================================

CREATE POLICY leases_owner_all ON public.leases
  FOR ALL USING (public.is_owner_of_property(property_id))
  WITH CHECK (public.is_owner_of_property(property_id));

CREATE POLICY leases_manager_read ON public.leases
  FOR SELECT USING (manager_id = auth.uid());

-- =========================================================================
-- tax_elections: owner only
-- =========================================================================

CREATE POLICY tax_elections_owner_all ON public.tax_elections
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- =========================================================================
-- approval_rules: owner manages; required approvers (co-owners) read
-- =========================================================================

CREATE POLICY approval_rules_owner_all ON public.approval_rules
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY approval_rules_approver_read ON public.approval_rules
  FOR SELECT USING (required_approvers ? auth.uid()::text);

-- =========================================================================
-- rent_payments
--   Manager (active lease): INSERT and SELECT for their leases
--   Owner: full CRUD on rent for properties they own
--   Co-owner: SELECT for properties they hold a split in
-- =========================================================================

CREATE POLICY rent_owner_all ON public.rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND public.is_owner_of_property(l.property_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND public.is_owner_of_property(l.property_id)
    )
  );

CREATE POLICY rent_manager_log ON public.rent_payments
  FOR INSERT WITH CHECK (
    logged_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND l.manager_id = auth.uid()
    )
  );

CREATE POLICY rent_manager_read ON public.rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND l.manager_id = auth.uid()
    )
  );

CREATE POLICY rent_co_owner_read ON public.rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND public.is_co_owner_of_property(l.property_id)
    )
  );

-- =========================================================================
-- expenses
--   Manager: INSERT (own properties) and SELECT (own properties)
--   Owner: full CRUD on properties they own
--   Co-owner: SELECT for properties they hold a split in
-- =========================================================================

CREATE POLICY expenses_owner_all ON public.expenses
  FOR ALL USING (public.is_owner_of_property(property_id))
  WITH CHECK (public.is_owner_of_property(property_id));

CREATE POLICY expenses_manager_log ON public.expenses
  FOR INSERT WITH CHECK (
    logged_by = auth.uid()
    AND public.is_active_manager_of_property(property_id)
  );

CREATE POLICY expenses_manager_read ON public.expenses
  FOR SELECT USING (public.is_active_manager_of_property(property_id));

-- Manager updates only own pending expenses (they can attach a missing receipt).
CREATE POLICY expenses_manager_update_own_pending ON public.expenses
  FOR UPDATE USING (
    status = 'pending'
    AND logged_by = auth.uid()
    AND public.is_active_manager_of_property(property_id)
  );

CREATE POLICY expenses_co_owner_read ON public.expenses
  FOR SELECT USING (public.is_co_owner_of_property(property_id));

-- Required approver can update status to 'approved' / 'rejected'.
CREATE POLICY expenses_approver_update ON public.expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.approval_rules ar
      WHERE ar.required_approvers ? auth.uid()::text
        AND (ar.property_id = expenses.property_id OR ar.property_id IS NULL)
    )
  );

-- =========================================================================
-- works: owner full CRUD; manager full CRUD on assigned properties
-- =========================================================================

CREATE POLICY works_owner_all ON public.works
  FOR ALL USING (public.is_owner_of_property(property_id))
  WITH CHECK (public.is_owner_of_property(property_id));

CREATE POLICY works_manager_all ON public.works
  FOR ALL USING (public.is_active_manager_of_property(property_id))
  WITH CHECK (public.is_active_manager_of_property(property_id));

-- =========================================================================
-- messages
--   Owner of property: full
--   Active manager of property: full
--   Co-owner: read only IF owner has enabled it (TODO Phase 2 — co-owner
--     messaging is opt-in per spec §12). For Phase 1 we hide it entirely.
-- =========================================================================

CREATE POLICY messages_property_access ON public.messages
  FOR SELECT USING (
    public.is_owner_of_property(property_id)
    OR public.is_active_manager_of_property(property_id)
  );

CREATE POLICY messages_property_send ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_owner_of_property(property_id)
      OR public.is_active_manager_of_property(property_id)
    )
  );

-- =========================================================================
-- audit_log: owner reads everything they touched; users read their own actions
-- =========================================================================

CREATE POLICY audit_self_read ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY audit_owner_read ON public.audit_log
  FOR SELECT USING (public.current_role() = 'owner');

-- INSERT into audit_log only by service role (server actions use it).

-- =========================================================================
-- invites: invited_by reads their own; nobody else.
-- =========================================================================

CREATE POLICY invites_inviter_all ON public.invites
  FOR ALL USING (invited_by = auth.uid())
  WITH CHECK (invited_by = auth.uid());

-- =========================================================================
-- notification_prefs: each user manages their own
-- =========================================================================

CREATE POLICY notif_self_all ON public.notification_prefs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
