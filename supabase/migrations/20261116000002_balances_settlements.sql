BEGIN;

CREATE FUNCTION private.trip_participant_net_balance(
  p_trip_id uuid,
  p_participant_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE((
      SELECT sum(expenses.amount)
      FROM public.expenses AS expenses
      WHERE expenses.trip_id = p_trip_id
        AND expenses.paid_by_participant_id = p_participant_id
    ), 0)
    - COALESCE((
      SELECT sum(shares.share_amount)
      FROM public.expense_shares AS shares
      WHERE shares.trip_id = p_trip_id
        AND shares.participant_id = p_participant_id
    ), 0)
    + COALESCE((
      SELECT sum(settlements.amount)
      FROM public.settlements AS settlements
      WHERE settlements.trip_id = p_trip_id
        AND settlements.from_participant_id = p_participant_id
    ), 0)
    - COALESCE((
      SELECT sum(settlements.amount)
      FROM public.settlements AS settlements
      WHERE settlements.trip_id = p_trip_id
        AND settlements.to_participant_id = p_participant_id
    ), 0);
$$;

CREATE FUNCTION public.get_trip_financials(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'participants', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', participants.id,
          'display_name', participants.display_name,
          'email', participants.email,
          'status', participants.status::text,
          'paid_amount', COALESCE((
            SELECT sum(expenses.amount)
            FROM public.expenses AS expenses
            WHERE expenses.trip_id = participants.trip_id
              AND expenses.paid_by_participant_id = participants.id
          ), 0)::text,
          'owed_amount', COALESCE((
            SELECT sum(shares.share_amount)
            FROM public.expense_shares AS shares
            WHERE shares.trip_id = participants.trip_id
              AND shares.participant_id = participants.id
          ), 0)::text,
          'settlements_paid', COALESCE((
            SELECT sum(settlements.amount)
            FROM public.settlements AS settlements
            WHERE settlements.trip_id = participants.trip_id
              AND settlements.from_participant_id = participants.id
          ), 0)::text,
          'settlements_received', COALESCE((
            SELECT sum(settlements.amount)
            FROM public.settlements AS settlements
            WHERE settlements.trip_id = participants.trip_id
              AND settlements.to_participant_id = participants.id
          ), 0)::text
        )
        ORDER BY lower(participants.display_name), participants.id
      )
      FROM public.trip_participants AS participants
      WHERE participants.trip_id = p_trip_id
        AND participants.status <> 'invited'
    ), '[]'::jsonb),
    'settlements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', settlements.id,
          'from_participant_id', settlements.from_participant_id,
          'from_name', payer.display_name,
          'to_participant_id', settlements.to_participant_id,
          'to_name', recipient.display_name,
          'amount', settlements.amount::text,
          'currency', settlements.currency,
          'payment_date', settlements.payment_date,
          'notes', settlements.notes,
          'created_at', settlements.created_at
        )
        ORDER BY settlements.payment_date DESC, settlements.created_at DESC, settlements.id
      )
      FROM public.settlements AS settlements
      JOIN public.trip_participants AS payer
        ON payer.id = settlements.from_participant_id
        AND payer.trip_id = settlements.trip_id
      JOIN public.trip_participants AS recipient
        ON recipient.id = settlements.to_participant_id
        AND recipient.trip_id = settlements.trip_id
      WHERE settlements.trip_id = p_trip_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.record_trip_settlement(
  p_trip_id uuid,
  p_from_participant_id uuid,
  p_to_participant_id uuid,
  p_amount text,
  p_payment_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_currency text;
  v_amount numeric(20, 6);
  v_from_balance numeric;
  v_to_balance numeric;
  v_settlement_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT trips.currency INTO v_currency
  FROM public.trips AS trips
  WHERE trips.id = p_trip_id;

  IF p_from_participant_id IS NULL
    OR p_to_participant_id IS NULL
    OR p_from_participant_id = p_to_participant_id
    OR p_amount IS NULL
    OR p_amount !~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
    OR p_payment_date IS NULL
    OR p_notes IS NOT NULL AND length(p_notes) > 5000
  THEN
    RAISE EXCEPTION 'Invalid settlement fields' USING ERRCODE = '22023';
  END IF;
  IF p_amount::numeric <= 0 THEN
    RAISE EXCEPTION 'Settlement amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trip_participants AS participants
    WHERE participants.id = p_from_participant_id
      AND participants.trip_id = p_trip_id
      AND participants.status <> 'invited'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.trip_participants AS participants
    WHERE participants.id = p_to_participant_id
      AND participants.trip_id = p_trip_id
      AND participants.status <> 'invited'
  ) THEN
    RAISE EXCEPTION 'Payer and recipient must be participants in this trip'
      USING ERRCODE = '23503';
  END IF;

  v_amount := p_amount::numeric(20, 6);
  v_from_balance := private.trip_participant_net_balance(p_trip_id, p_from_participant_id);
  v_to_balance := private.trip_participant_net_balance(p_trip_id, p_to_participant_id);

  IF v_from_balance >= 0 OR v_to_balance <= 0
    OR v_amount > -v_from_balance OR v_amount > v_to_balance
  THEN
    RAISE EXCEPTION 'Settlement amount exceeds payer debt or recipient credit'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.settlements AS settlements
    WHERE settlements.trip_id = p_trip_id
      AND settlements.from_participant_id = p_from_participant_id
      AND settlements.to_participant_id = p_to_participant_id
      AND settlements.amount = v_amount
      AND settlements.payment_date = p_payment_date
      AND settlements.notes IS NOT DISTINCT FROM NULLIF(btrim(p_notes), '')
  ) THEN
    RAISE EXCEPTION 'Duplicate settlement' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.settlements (
    trip_id,
    from_participant_id,
    to_participant_id,
    amount,
    currency,
    payment_date,
    notes,
    created_by
  )
  VALUES (
    p_trip_id,
    p_from_participant_id,
    p_to_participant_id,
    v_amount,
    v_currency,
    p_payment_date,
    NULLIF(btrim(p_notes), ''),
    v_user_id
  )
  RETURNING id INTO v_settlement_id;

  RETURN v_settlement_id;
END;
$$;

REVOKE ALL ON FUNCTION private.trip_participant_net_balance(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.settlements FROM authenticated;
REVOKE ALL ON FUNCTION public.get_trip_financials(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_trip_settlement(uuid, uuid, uuid, text, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_financials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_trip_settlement(uuid, uuid, uuid, text, date, text)
  TO authenticated;

COMMIT;
