-- Spec §7: when a lease ends, the manager loses access to that property's
-- future data, BUT retains read-only access to their own historical messages
-- and expense logs (their own actions only).
--
-- This adds the "self-only" read policies on messages and rent_payments
-- so a former manager can still review what they did.

CREATE POLICY messages_self_history ON public.messages
  FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY rent_self_history ON public.rent_payments
  FOR SELECT USING (logged_by = auth.uid());

-- expenses already has a separate policy: expenses_manager_read filters on
-- public.is_active_manager_of_property which becomes false after the lease
-- ends. Add a self-history policy mirroring the others above.
CREATE POLICY expenses_self_history ON public.expenses
  FOR SELECT USING (logged_by = auth.uid());

-- A new manager must NOT see messages between owner and previous manager.
-- That's already the case: messages_property_access requires either
-- is_owner_of_property OR is_active_manager_of_property, AND messages have
-- no owner concept beyond sender_id. The new manager sees a clean slate
-- (their own messages and the owner's messages going forward) because the
-- existing policies already exclude historical messages they didn't send.
--
-- Actually the existing messages_property_access lets ANY active manager
-- see ALL messages on the property — including past manager messages.
-- Tighten it so an active manager only sees messages from on-or-after
-- their lease start date.

DROP POLICY IF EXISTS messages_property_access ON public.messages;

CREATE POLICY messages_owner_read ON public.messages
  FOR SELECT USING (public.is_owner_of_property(property_id));

CREATE POLICY messages_active_manager_read ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.property_id = messages.property_id
        AND l.manager_id = auth.uid()
        AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
        AND messages.created_at >= l.start_date::timestamptz
    )
  );
