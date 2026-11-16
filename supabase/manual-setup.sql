-- BEGIN ORIGINAL MIGRATION: 20261114000000_initial_schema.sql
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TYPE public.trip_participant_role AS ENUM ('owner', 'member');
CREATE TYPE public.trip_participant_status AS ENUM ('active', 'invited', 'inactive');
CREATE TYPE public.expense_share_type AS ENUM ('equal', 'custom', 'percentage');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text CHECK (
    display_name IS NULL
    OR (length(btrim(display_name)) BETWEEN 1 AND 80)
  ),
  avatar_url text CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  start_date date NOT NULL,
  end_date date,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX trips_created_by_idx ON public.trips (created_by);

CREATE TABLE public.trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  email text CHECK (email IS NULL OR length(email) <= 320),
  role public.trip_participant_role NOT NULL DEFAULT 'member',
  status public.trip_participant_status NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_participants_id_trip_unique UNIQUE (id, trip_id)
);

CREATE UNIQUE INDEX trip_participants_trip_user_unique
  ON public.trip_participants (trip_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX trip_participants_one_owner_unique
  ON public.trip_participants (trip_id)
  WHERE role = 'owner';
CREATE INDEX trip_participants_user_status_idx
  ON public.trip_participants (user_id, status)
  WHERE user_id IS NOT NULL;
CREATE INDEX trip_participants_trip_status_idx
  ON public.trip_participants (trip_id, status);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 240),
  amount numeric(20, 6) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  category text NOT NULL DEFAULT 'other'
    CHECK (length(btrim(category)) BETWEEN 1 AND 50),
  expense_date date NOT NULL,
  paid_by_participant_id uuid NOT NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 5000),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_id_trip_unique UNIQUE (id, trip_id),
  CONSTRAINT expenses_paid_by_participant_trip_fkey
    FOREIGN KEY (paid_by_participant_id, trip_id)
    REFERENCES public.trip_participants (id, trip_id)
);

CREATE INDEX expenses_trip_date_idx ON public.expenses (trip_id, expense_date DESC);
CREATE INDEX expenses_paid_by_participant_trip_idx
  ON public.expenses (paid_by_participant_id, trip_id);
CREATE INDEX expenses_created_by_idx ON public.expenses (created_by);

CREATE TABLE public.expense_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  share_amount numeric(20, 6) NOT NULL CHECK (share_amount >= 0),
  share_type public.expense_share_type NOT NULL,
  share_percentage numeric(9, 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_shares_percentage_check CHECK (
    (
      share_type = 'percentage'
      AND share_percentage IS NOT NULL
      AND share_percentage BETWEEN 0 AND 100
    )
    OR (share_type <> 'percentage' AND share_percentage IS NULL)
  ),
  CONSTRAINT expense_shares_expense_participant_unique
    UNIQUE (expense_id, participant_id),
  CONSTRAINT expense_shares_expense_trip_fkey
    FOREIGN KEY (expense_id, trip_id)
    REFERENCES public.expenses (id, trip_id) ON DELETE CASCADE,
  CONSTRAINT expense_shares_participant_trip_fkey
    FOREIGN KEY (participant_id, trip_id)
    REFERENCES public.trip_participants (id, trip_id)
);

CREATE INDEX expense_shares_trip_participant_idx
  ON public.expense_shares (trip_id, participant_id);

CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  from_participant_id uuid NOT NULL,
  to_participant_id uuid NOT NULL,
  amount numeric(20, 6) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_date date NOT NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 5000),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlements_distinct_participants_check
    CHECK (from_participant_id <> to_participant_id),
  CONSTRAINT settlements_from_participant_trip_fkey
    FOREIGN KEY (from_participant_id, trip_id)
    REFERENCES public.trip_participants (id, trip_id),
  CONSTRAINT settlements_to_participant_trip_fkey
    FOREIGN KEY (to_participant_id, trip_id)
    REFERENCES public.trip_participants (id, trip_id)
);

CREATE INDEX settlements_trip_date_idx
  ON public.settlements (trip_id, payment_date DESC);
CREATE INDEX settlements_from_participant_trip_idx
  ON public.settlements (from_participant_id, trip_id);
CREATE INDEX settlements_to_participant_trip_idx
  ON public.settlements (to_participant_id, trip_id);

CREATE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'display_name'), 80), ''),
    NULLIF(left(NEW.raw_user_meta_data ->> 'avatar_url', 2048), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  users.id,
  NULLIF(left(btrim(users.raw_user_meta_data ->> 'display_name'), 80), ''),
  NULLIF(left(users.raw_user_meta_data ->> 'avatar_url', 2048), '')
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

CREATE FUNCTION private.add_trip_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
  v_email text;
BEGIN
  SELECT
    COALESCE(
      profiles.display_name,
      NULLIF(left(btrim(users.raw_user_meta_data ->> 'display_name'), 80), ''),
      'Trip creator'
    ),
    users.email
  INTO v_display_name, v_email
  FROM auth.users AS users
  LEFT JOIN public.profiles AS profiles ON profiles.id = users.id
  WHERE users.id = NEW.created_by;

  INSERT INTO public.trip_participants (
    trip_id,
    user_id,
    display_name,
    email,
    role,
    status
  )
  VALUES (
    NEW.id,
    NEW.created_by,
    v_display_name,
    v_email,
    'owner',
    'active'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.add_trip_creator_as_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trips_add_creator_as_owner
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION private.add_trip_creator_as_owner();

CREATE FUNCTION private.prevent_creator_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER expenses_prevent_creator_change
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.prevent_creator_change();
CREATE TRIGGER settlements_prevent_creator_change
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION private.prevent_creator_change();

CREATE FUNCTION private.assert_expense_shares(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric(20, 6);
  v_share_count bigint;
  v_share_sum numeric(20, 6);
  v_type_count bigint;
  v_share_type public.expense_share_type;
  v_percentage_sum numeric(20, 6);
  v_base numeric(20, 6);
  v_expected numeric(20, 6);
  v_running_total numeric(20, 6) := 0;
  v_index bigint := 0;
  v_share record;
BEGIN
  SELECT expenses.amount
  INTO v_total
  FROM public.expenses AS expenses
  WHERE expenses.id = p_expense_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    count(*),
    COALESCE(sum(shares.share_amount), 0),
    count(DISTINCT shares.share_type),
    (array_agg(shares.share_type))[1],
    COALESCE(sum(shares.share_percentage), 0)
  INTO v_share_count, v_share_sum, v_type_count, v_share_type, v_percentage_sum
  FROM public.expense_shares AS shares
  WHERE shares.expense_id = p_expense_id;

  IF v_share_count = 0 OR v_type_count <> 1 OR v_share_sum <> v_total THEN
    RAISE EXCEPTION 'Expense shares must use one split type and sum exactly to the expense total'
      USING ERRCODE = '23514';
  END IF;

  IF v_share_type = 'percentage' AND v_percentage_sum <> 100 THEN
    RAISE EXCEPTION 'Percentage shares must sum exactly to 100'
      USING ERRCODE = '23514';
  END IF;

  IF v_share_type = 'equal' THEN
    v_base := trunc(v_total / v_share_count, 6);
  END IF;

  FOR v_share IN
    SELECT shares.participant_id, shares.share_amount, shares.share_percentage
    FROM public.expense_shares AS shares
    WHERE shares.expense_id = p_expense_id
    ORDER BY shares.participant_id
  LOOP
    v_index := v_index + 1;

    IF v_share_type = 'equal' THEN
      IF v_index = v_share_count THEN
        v_expected := v_total - v_running_total;
      ELSE
        v_expected := v_base;
      END IF;
    ELSIF v_share_type = 'percentage' THEN
      IF v_index = v_share_count THEN
        v_expected := v_total - v_running_total;
      ELSE
        v_expected := trunc(v_total * v_share.share_percentage / 100, 6);
      END IF;
    ELSE
      CONTINUE;
    END IF;

    IF v_share.share_amount <> v_expected THEN
      RAISE EXCEPTION 'Equal and percentage shares must follow the deterministic rounding strategy'
        USING ERRCODE = '23514';
    END IF;

    v_running_total := v_running_total + v_expected;
  END LOOP;
END;
$$;

CREATE FUNCTION private.validate_expense_shares()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'expenses' THEN
    PERFORM private.assert_expense_shares(NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN
      PERFORM private.assert_expense_shares(OLD.expense_id);
    END IF;

    IF TG_OP <> 'DELETE'
      AND (TG_OP = 'INSERT' OR NEW.expense_id IS DISTINCT FROM OLD.expense_id)
    THEN
      PERFORM private.assert_expense_shares(NEW.expense_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION private.lock_expense_for_share_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  FOR v_expense_id IN
    SELECT DISTINCT expense_ids.id
    FROM unnest(
      CASE
        WHEN TG_OP = 'INSERT' THEN ARRAY[NEW.expense_id]
        WHEN TG_OP = 'DELETE' THEN ARRAY[OLD.expense_id]
        ELSE ARRAY[OLD.expense_id, NEW.expense_id]
      END
    ) AS expense_ids(id)
    WHERE expense_ids.id IS NOT NULL
    ORDER BY expense_ids.id
  LOOP
    PERFORM 1
    FROM public.expenses AS expenses
    WHERE expenses.id = v_expense_id
    FOR UPDATE;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_expense_shares(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_expense_shares() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lock_expense_for_share_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER expense_shares_lock_expense
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_shares
  FOR EACH ROW EXECUTE FUNCTION private.lock_expense_for_share_change();

CREATE CONSTRAINT TRIGGER expenses_shares_consistent
  AFTER INSERT OR UPDATE ON public.expenses
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.validate_expense_shares();
CREATE CONSTRAINT TRIGGER expense_shares_consistent
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_shares
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.validate_expense_shares();
-- END ORIGINAL MIGRATION: 20261114000000_initial_schema.sql

-- BEGIN ORIGINAL MIGRATION: 20261114000001_row_level_security.sql
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
-- END ORIGINAL MIGRATION: 20261114000001_row_level_security.sql
