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
