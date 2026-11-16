CREATE FUNCTION private.is_trip_member(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_participants AS participants
    WHERE participants.trip_id = p_trip_id
      AND participants.user_id = (SELECT auth.uid())
      AND participants.status = 'active'
  );
$$;

CREATE FUNCTION private.is_trip_manager(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips AS trips
    WHERE trips.id = p_trip_id
      AND trips.created_by = (SELECT auth.uid())
  )
  AND private.is_trip_member(p_trip_id);
$$;

CREATE FUNCTION private.can_manage_expense(p_expense_id uuid, p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expenses AS expenses
    WHERE expenses.id = p_expense_id
      AND expenses.trip_id = p_trip_id
      AND (
        expenses.created_by = (SELECT auth.uid())
        OR private.is_trip_manager(p_trip_id)
      )
  )
  AND private.is_trip_member(p_trip_id);
$$;

REVOKE ALL ON FUNCTION private.is_trip_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_trip_manager(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_manage_expense(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_expense(uuid, uuid) TO authenticated;

CREATE FUNCTION public.create_expense_with_shares(
  p_trip_id uuid,
  p_description text,
  p_amount text,
  p_currency text,
  p_expense_date date,
  p_paid_by_participant_id uuid,
  p_shares jsonb,
  p_category text DEFAULT 'other',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  IF jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_shares must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_shares) = 0 THEN
    RAISE EXCEPTION 'At least one expense share is required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.expenses (
    trip_id,
    description,
    amount,
    currency,
    category,
    expense_date,
    paid_by_participant_id,
    notes,
    created_by
  )
  VALUES (
    p_trip_id,
    p_description,
    p_amount::numeric,
    p_currency,
    p_category,
    p_expense_date,
    p_paid_by_participant_id,
    p_notes,
    (SELECT auth.uid())
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.expense_shares (
    expense_id,
    trip_id,
    participant_id,
    share_amount,
    share_type,
    share_percentage
  )
  SELECT
    v_expense_id,
    p_trip_id,
    (share.value ->> 'participant_id')::uuid,
    (share.value ->> 'share_amount')::numeric,
    (share.value ->> 'share_type')::public.expense_share_type,
    NULLIF(share.value ->> 'share_percentage', '')::numeric
  FROM jsonb_array_elements(p_shares) AS share(value);

  RETURN v_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_with_shares(
  uuid, text, text, text, date, uuid, jsonb, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_with_shares(
  uuid, text, text, text, date, uuid, jsonb, text, text
) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.profiles,
  public.trips,
  public.trip_participants,
  public.expenses,
  public.expense_shares,
  public.settlements
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

GRANT SELECT, DELETE ON public.trips TO authenticated;
GRANT INSERT (name, description, start_date, end_date, currency, created_by)
  ON public.trips TO authenticated;
GRANT UPDATE (name, description, start_date, end_date, currency)
  ON public.trips TO authenticated;

GRANT SELECT, DELETE ON public.trip_participants TO authenticated;
GRANT INSERT (trip_id, user_id, display_name, email, role, status)
  ON public.trip_participants TO authenticated;
GRANT UPDATE (user_id, display_name, email, status)
  ON public.trip_participants TO authenticated;

GRANT SELECT, DELETE ON public.expenses TO authenticated;
GRANT INSERT (
  trip_id, description, amount, currency, category, expense_date,
  paid_by_participant_id, notes, created_by
) ON public.expenses TO authenticated;
GRANT UPDATE (
  trip_id, description, amount, currency, category, expense_date,
  paid_by_participant_id, notes
) ON public.expenses TO authenticated;

GRANT SELECT, DELETE ON public.expense_shares TO authenticated;
GRANT INSERT (
  expense_id, trip_id, participant_id, share_amount, share_type, share_percentage
) ON public.expense_shares TO authenticated;
GRANT UPDATE (
  participant_id, share_amount, share_type, share_percentage
) ON public.expense_shares TO authenticated;

GRANT SELECT, DELETE ON public.settlements TO authenticated;
GRANT INSERT (
  trip_id, from_participant_id, to_participant_id,
  amount, currency, payment_date, notes, created_by
) ON public.settlements TO authenticated;
GRANT UPDATE (
  trip_id, from_participant_id, to_participant_id,
  amount, currency, payment_date, notes
) ON public.settlements TO authenticated;

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY trips_select_member
  ON public.trips FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT private.is_trip_member(id))
  );
CREATE POLICY trips_insert_creator
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY trips_update_manager
  ON public.trips FOR UPDATE TO authenticated
  USING ((SELECT private.is_trip_manager(id)))
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT private.is_trip_manager(id))
  );
CREATE POLICY trips_delete_manager
  ON public.trips FOR DELETE TO authenticated
  USING ((SELECT private.is_trip_manager(id)));

CREATE POLICY trip_participants_select_member
  ON public.trip_participants FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY trip_participants_insert_manager
  ON public.trip_participants FOR INSERT TO authenticated
  WITH CHECK (
    role = 'member'
    AND (SELECT private.is_trip_manager(trip_id))
  );
CREATE POLICY trip_participants_update_manager
  ON public.trip_participants FOR UPDATE TO authenticated
  USING (
    role = 'member'
    AND (SELECT private.is_trip_manager(trip_id))
  )
  WITH CHECK (
    role = 'member'
    AND (SELECT private.is_trip_manager(trip_id))
  );
CREATE POLICY trip_participants_delete_manager
  ON public.trip_participants FOR DELETE TO authenticated
  USING (
    role = 'member'
    AND (SELECT private.is_trip_manager(trip_id))
  );

CREATE POLICY expenses_select_member
  ON public.expenses FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY expenses_insert_member
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT private.is_trip_member(trip_id))
  );
CREATE POLICY expenses_update_authorized
  ON public.expenses FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_expense(id, trip_id)))
  WITH CHECK ((SELECT private.can_manage_expense(id, trip_id)));
CREATE POLICY expenses_delete_authorized
  ON public.expenses FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_expense(id, trip_id)));

CREATE POLICY expense_shares_select_member
  ON public.expense_shares FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY expense_shares_insert_authorized
  ON public.expense_shares FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.can_manage_expense(expense_id, trip_id))
  );
CREATE POLICY expense_shares_update_authorized
  ON public.expense_shares FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_expense(expense_id, trip_id)))
  WITH CHECK ((SELECT private.can_manage_expense(expense_id, trip_id)));
CREATE POLICY expense_shares_delete_authorized
  ON public.expense_shares FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_expense(expense_id, trip_id)));

CREATE POLICY settlements_select_member
  ON public.settlements FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY settlements_insert_member
  ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT private.is_trip_member(trip_id))
  );
CREATE POLICY settlements_update_authorized
  ON public.settlements FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_trip_member(trip_id))
    AND (
      created_by = (SELECT auth.uid())
      OR (SELECT private.is_trip_manager(trip_id))
    )
  )
  WITH CHECK (
    (SELECT private.is_trip_member(trip_id))
    AND (
      created_by = (SELECT auth.uid())
      OR (SELECT private.is_trip_manager(trip_id))
    )
  );
CREATE POLICY settlements_delete_authorized
  ON public.settlements FOR DELETE TO authenticated
  USING (
    (SELECT private.is_trip_member(trip_id))
    AND (
      created_by = (SELECT auth.uid())
      OR (SELECT private.is_trip_manager(trip_id))
    )
  );
