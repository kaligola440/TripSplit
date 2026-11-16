BEGIN;

CREATE OR REPLACE FUNCTION public.save_expense_with_shares(
  p_expense_id uuid,
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trip_currency text;
  v_existing public.expenses%ROWTYPE;
  v_expense_id uuid;
  v_share_count bigint;
  v_distinct_count bigint;
  v_type_count bigint;
  v_share_sum numeric(20, 6);
  v_percentage_sum numeric(20, 6);
  v_share_type public.expense_share_type;
  v_share_type_text text;
  v_base numeric(20, 6);
  v_expected numeric(20, 6);
  v_running_total numeric(20, 6) := 0;
  v_index bigint := 0;
  v_share record;
  v_amount numeric(20, 6);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT currency INTO v_trip_currency FROM public.trips WHERE id = p_trip_id;
  IF p_currency IS DISTINCT FROM v_trip_currency THEN
    RAISE EXCEPTION 'Expense currency must match trip currency' USING ERRCODE = '22023';
  END IF;
  IF p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 1 AND 240
    OR p_category IS NULL OR length(btrim(p_category)) NOT BETWEEN 1 AND 50
    OR p_expense_date IS NULL OR p_notes IS NOT NULL AND length(p_notes) > 5000
    OR p_amount IS NULL OR p_amount !~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
    OR p_amount::numeric <= 0
    OR p_shares IS NULL OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_shares) = 0 OR jsonb_array_length(p_shares) > 100 THEN
    RAISE EXCEPTION 'Invalid expense fields' USING ERRCODE = '22023';
  END IF;
  v_amount := p_amount::numeric(20, 6);
  IF NOT EXISTS (SELECT 1 FROM public.trip_participants
    WHERE id = p_paid_by_participant_id AND trip_id = p_trip_id AND status = 'active') THEN
    RAISE EXCEPTION 'Payer must be an active participant in this trip' USING ERRCODE = '23503';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_shares) AS requested(participant_id uuid, share_amount text, share_type text, share_percentage text)
    LEFT JOIN public.trip_participants AS participants
      ON participants.id = requested.participant_id
      AND participants.trip_id = p_trip_id AND participants.status = 'active'
    WHERE participants.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every share must reference an active participant in this trip' USING ERRCODE = '23503';
  END IF;
  SELECT count(*), count(DISTINCT requested.participant_id),
    count(DISTINCT requested.share_type), min(requested.share_type),
    COALESCE(sum(requested.share_amount::numeric), 0),
    COALESCE(sum(NULLIF(requested.share_percentage, '')::numeric), 0)
  INTO v_share_count, v_distinct_count, v_type_count, v_share_type_text, v_share_sum, v_percentage_sum
  FROM jsonb_to_recordset(p_shares) AS requested(
    participant_id uuid, share_amount text, share_type text, share_percentage text
  );
  IF v_share_count = 0 OR v_distinct_count <> v_share_count OR v_type_count <> 1 THEN
    RAISE EXCEPTION 'Shares must contain distinct participants and one split method' USING ERRCODE = '22023';
  END IF;
  v_share_type := v_share_type_text::public.expense_share_type;
  IF v_share_type = 'custom' THEN
    IF v_share_sum <> v_amount OR EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_shares) AS requested(
        participant_id uuid, share_amount text, share_type text, share_percentage text
      )
      WHERE requested.share_amount !~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
        OR requested.share_amount::numeric < 0 OR requested.share_percentage IS NOT NULL
        OR requested.share_type <> 'custom'
    ) THEN RAISE EXCEPTION 'Custom shares must be non-negative and sum exactly to the expense' USING ERRCODE = '23514'; END IF;
  ELSIF v_share_type IN ('equal', 'percentage') THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_shares) AS requested(
        participant_id uuid, share_amount text, share_type text, share_percentage text
      )
      WHERE requested.share_amount !~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
        OR requested.share_amount::numeric < 0 OR requested.share_type::public.expense_share_type <> v_share_type
        OR (v_share_type = 'equal' AND requested.share_percentage IS NOT NULL)
        OR (v_share_type = 'percentage' AND (
          requested.share_percentage IS NULL
          OR requested.share_percentage !~ '^(0|[1-9][0-9]{0,2})(\.[0-9]{1,6})?$'
          OR requested.share_percentage::numeric NOT BETWEEN 0 AND 100
        ))
    ) THEN RAISE EXCEPTION 'Invalid split values' USING ERRCODE = '23514'; END IF;
    IF v_share_type = 'percentage' AND v_percentage_sum <> 100 THEN
      RAISE EXCEPTION 'Percentages must sum exactly to 100' USING ERRCODE = '23514';
    END IF;
    v_base := trunc(v_amount / v_share_count, 6);
    FOR v_share IN
      SELECT requested.participant_id, requested.share_amount::numeric(20, 6) AS share_amount,
        NULLIF(requested.share_percentage, '')::numeric(9, 6) AS share_percentage
      FROM jsonb_to_recordset(p_shares) AS requested(
        participant_id uuid, share_amount text, share_type text, share_percentage text
      )
      ORDER BY requested.participant_id
    LOOP
      v_index := v_index + 1;
      IF v_index = v_share_count THEN
        v_expected := v_amount - v_running_total;
      ELSIF v_share_type = 'equal' THEN
        v_expected := v_base;
      ELSE
        v_expected := trunc(v_amount * v_share.share_percentage / 100, 6);
      END IF;
      IF v_share.share_amount <> v_expected THEN
        RAISE EXCEPTION 'Shares do not match deterministic split rounding' USING ERRCODE = '23514';
      END IF;
      v_running_total := v_running_total + v_expected;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Invalid split method' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.settlements WHERE trip_id = p_trip_id) THEN
    RAISE EXCEPTION 'Settlements exist; expense changes are locked to preserve financial history' USING ERRCODE = '55000';
  END IF;
  IF p_expense_id IS NULL THEN
    INSERT INTO public.expenses(trip_id, description, amount, currency, category, expense_date,
      paid_by_participant_id, notes, created_by)
    VALUES (p_trip_id, btrim(p_description), v_amount, p_currency, btrim(p_category), p_expense_date,
      p_paid_by_participant_id, p_notes, v_user_id)
    RETURNING id INTO v_expense_id;
  ELSE
    SELECT * INTO v_existing FROM public.expenses
      WHERE id = p_expense_id AND trip_id = p_trip_id FOR UPDATE;
    IF NOT FOUND OR NOT (
      private.is_trip_manager(p_trip_id) OR v_existing.created_by = v_user_id
    ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
    v_expense_id := p_expense_id;
    UPDATE public.expenses SET description = btrim(p_description), amount = v_amount, currency = p_currency,
      category = btrim(p_category), expense_date = p_expense_date,
      paid_by_participant_id = p_paid_by_participant_id, notes = p_notes
    WHERE id = p_expense_id AND trip_id = p_trip_id;
    DELETE FROM public.expense_shares WHERE expense_id = p_expense_id AND trip_id = p_trip_id;
  END IF;
  INSERT INTO public.expense_shares(expense_id, trip_id, participant_id, share_amount, share_type, share_percentage)
  SELECT v_expense_id, p_trip_id, requested.participant_id,
    requested.share_amount::numeric(20, 6), requested.share_type::public.expense_share_type,
    NULLIF(requested.share_percentage, '')::numeric(9, 6)
  FROM jsonb_to_recordset(p_shares) AS requested(
    participant_id uuid, share_amount text, share_type text, share_percentage text
  );
  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_expense_with_shares(
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
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.save_expense_with_shares(NULL, p_trip_id, p_description, p_amount, p_currency,
    p_expense_date, p_paid_by_participant_id, p_shares, p_category, p_notes);
$$;

CREATE FUNCTION public.delete_expense(p_trip_id uuid, p_expense_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id AND trip_id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT (private.is_trip_manager(p_trip_id) OR v_expense.created_by = v_user_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.settlements WHERE trip_id = p_trip_id) THEN
    RETURN 'settlements_exist';
  END IF;
  DELETE FROM public.expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
  RETURN 'deleted';
END;
$$;

CREATE FUNCTION public.list_trip_expenses(
  p_trip_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL,
  p_category text DEFAULT NULL, p_payer uuid DEFAULT NULL, p_search text DEFAULT NULL,
  p_sort text DEFAULT 'date_desc'
)
RETURNS TABLE(
  id uuid, description text, amount text, currency text, category text,
  expense_date date, paid_by_participant_id uuid, payer_name text, share_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT e.id, e.description, e.amount::text, e.currency, e.category, e.expense_date,
    e.paid_by_participant_id, p.display_name,
    (SELECT count(*) FROM public.expense_shares AS s WHERE s.expense_id = e.id)
  FROM public.expenses AS e
  JOIN public.trip_participants AS p ON p.id = e.paid_by_participant_id AND p.trip_id = e.trip_id
  WHERE e.trip_id = p_trip_id
    AND (p_date_from IS NULL OR e.expense_date >= p_date_from)
    AND (p_date_to IS NULL OR e.expense_date <= p_date_to)
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_payer IS NULL OR e.paid_by_participant_id = p_payer)
    AND (p_search IS NULL OR e.description ILIKE '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\')
  ORDER BY
    CASE WHEN p_sort = 'date_asc' THEN e.expense_date END ASC,
    CASE WHEN p_sort = 'date_desc' THEN e.expense_date END DESC,
    CASE WHEN p_sort = 'amount_asc' THEN e.amount END ASC,
    CASE WHEN p_sort = 'amount_desc' THEN e.amount END DESC,
    e.id;
$$;

CREATE FUNCTION public.get_expense_detail(p_expense_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'trip_id', e.trip_id, 'description', e.description,
    'amount', e.amount::text, 'currency', e.currency, 'category', e.category,
    'expense_date', e.expense_date, 'paid_by_participant_id', e.paid_by_participant_id,
    'payer_name', payer.display_name, 'notes', e.notes, 'created_by', e.created_by,
    'shares', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'participant_id', s.participant_id, 'display_name', participant.display_name,
        'email', participant.email, 'share_amount', s.share_amount::text,
        'share_type', s.share_type, 'share_percentage', s.share_percentage::text
      ) ORDER BY s.participant_id)
      FROM public.expense_shares AS s
      JOIN public.trip_participants AS participant ON participant.id = s.participant_id
        AND participant.trip_id = s.trip_id
      WHERE s.expense_id = e.id AND s.trip_id = e.trip_id
    ), '[]'::jsonb)
  )
  FROM public.expenses AS e
  JOIN public.trip_participants AS payer ON payer.id = e.paid_by_participant_id AND payer.trip_id = e.trip_id
  WHERE e.id = p_expense_id;
$$;

CREATE FUNCTION private.lock_trip_for_settlement_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  FOR v_trip_id IN
    SELECT DISTINCT trip_ids.id
    FROM unnest(
      CASE
        WHEN TG_OP = 'INSERT' THEN ARRAY[NEW.trip_id]
        WHEN TG_OP = 'DELETE' THEN ARRAY[OLD.trip_id]
        ELSE ARRAY[OLD.trip_id, NEW.trip_id]
      END
    ) AS trip_ids(id)
    WHERE trip_ids.id IS NOT NULL
    ORDER BY trip_ids.id
  LOOP
    PERFORM 1 FROM public.trips WHERE id = v_trip_id FOR UPDATE;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_trip_for_settlement_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER settlements_lock_trip_for_expense_history
  BEFORE INSERT OR UPDATE OR DELETE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION private.lock_trip_for_settlement_change();

REVOKE INSERT, UPDATE, DELETE ON public.expenses, public.expense_shares FROM authenticated;
REVOKE ALL ON FUNCTION public.save_expense_with_shares(uuid, uuid, text, text, text, date, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_expense_with_shares(uuid, text, text, text, date, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_expense(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_trip_expenses(uuid, date, date, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_expense_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_expense_with_shares(uuid, uuid, text, text, text, date, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_with_shares(uuid, text, text, text, date, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expense(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_trip_expenses(uuid, date, date, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_detail(uuid) TO authenticated;

COMMIT;
