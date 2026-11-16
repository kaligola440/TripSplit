BEGIN;

CREATE FUNCTION public.get_trip_dashboard()
RETURNS TABLE(
  id uuid,
  name text,
  start_date date,
  end_date date,
  currency text,
  participant_count bigint,
  total_expenses text,
  net_balance text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    trip_row.id,
    trip_row.name,
    trip_row.start_date,
    trip_row.end_date,
    trip_row.currency,
    (
      SELECT count(*)
      FROM public.trip_participants AS participants
      WHERE participants.trip_id = trip_row.id
        AND participants.status = 'active'
    ) AS participant_count,
    COALESCE((
      SELECT sum(expenses.amount)
      FROM public.expenses AS expenses
      WHERE expenses.trip_id = trip_row.id
    ), 0)::text AS total_expenses,
    private.trip_participant_net_balance(trip_row.id, viewer.id)::text AS net_balance
  FROM public.trips AS trip_row
  JOIN public.trip_participants AS viewer
    ON viewer.trip_id = trip_row.id
    AND viewer.user_id = auth.uid()
    AND viewer.status = 'active'
  ORDER BY trip_row.start_date, trip_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trip_dashboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_dashboard() TO authenticated;

COMMIT;
