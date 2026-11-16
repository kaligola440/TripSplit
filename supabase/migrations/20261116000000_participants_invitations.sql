BEGIN;

CREATE TABLE public.trip_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  email text NOT NULL CHECK (
    email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_invitations_participant_trip_fkey
    FOREIGN KEY (participant_id, trip_id)
    REFERENCES public.trip_participants(id, trip_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX trip_invitations_one_pending_email
  ON public.trip_invitations(trip_id, email) WHERE status = 'pending';
CREATE INDEX trip_invitations_trip_idx ON public.trip_invitations(trip_id, created_at DESC);

ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, trip_id, participant_id, email, status, expires_at, created_at, updated_at)
  ON public.trip_invitations TO authenticated;
CREATE POLICY trip_invitations_select_member
  ON public.trip_invitations FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));

-- Direct participant writes would allow assigning an arbitrary account without consent.
REVOKE INSERT (trip_id, user_id, display_name, email, role, status)
  ON public.trip_participants FROM authenticated;
REVOKE UPDATE (user_id, display_name, email, status)
  ON public.trip_participants FROM authenticated;
REVOKE DELETE ON public.trip_participants FROM authenticated;

CREATE FUNCTION public.add_external_participant(p_trip_id uuid, p_name text, p_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_name);
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT private.is_trip_manager(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80
    OR v_email IS NULL OR length(v_email) NOT BETWEEN 3 AND 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid participant' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trip_participants
    WHERE trip_id = p_trip_id AND lower(btrim(email)) = v_email) THEN
    RAISE EXCEPTION 'Participant already exists' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.trip_participants(trip_id, display_name, email, role, status)
    VALUES (p_trip_id, v_name, v_email, 'member', 'active')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_trip_invitation(
  p_trip_id uuid, p_name text, p_email text, p_token_hash text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_name);
  v_participant public.trip_participants%ROWTYPE;
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT private.is_trip_manager(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80
    OR v_email IS NULL OR length(v_email) NOT BETWEEN 3 AND 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
  END IF;
  UPDATE public.trip_invitations SET status = 'expired', updated_at = now()
    WHERE trip_id = p_trip_id AND email = v_email
      AND status = 'pending' AND expires_at <= clock_timestamp();
  IF EXISTS (SELECT 1 FROM public.trip_invitations
    WHERE trip_id = p_trip_id AND email = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'Invitation already pending' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.trip_participants
    WHERE trip_id = p_trip_id AND lower(btrim(email)) = v_email) > 1 THEN
    RAISE EXCEPTION 'Multiple matching participants' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO v_participant FROM public.trip_participants
    WHERE trip_id = p_trip_id AND lower(btrim(email)) = v_email FOR UPDATE;
  IF FOUND AND (v_participant.role = 'owner' OR
    (v_participant.user_id IS NOT NULL AND v_participant.status = 'active')) THEN
    RAISE EXCEPTION 'Participant already active' USING ERRCODE = '23505';
  END IF;
  IF v_participant.id IS NULL THEN
    INSERT INTO public.trip_participants(trip_id, display_name, email, role, status)
      VALUES (p_trip_id, v_name, v_email, 'member', 'invited')
      RETURNING id INTO v_participant.id;
  END IF;
  INSERT INTO public.trip_invitations(trip_id, participant_id, email, token_hash, created_by)
    VALUES (p_trip_id, v_participant.id, v_email, p_token_hash, auth.uid())
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.resend_trip_invitation(p_trip_id uuid, p_invitation_id uuid, p_token_hash text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_invitation public.trip_invitations%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT private.is_trip_manager(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_invitation FROM public.trip_invitations
    WHERE id = p_invitation_id AND trip_id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR v_invitation.status NOT IN ('pending', 'expired') THEN
    RAISE EXCEPTION 'Invitation cannot be resent' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trip_participants
    WHERE id = v_invitation.participant_id AND user_id IS NOT NULL AND status = 'active') THEN
    RAISE EXCEPTION 'Participant already active' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trip_invitations
    WHERE trip_id = p_trip_id AND email = v_invitation.email
      AND status = 'pending' AND id <> p_invitation_id) THEN
    RAISE EXCEPTION 'Invitation already pending' USING ERRCODE = '23505';
  END IF;
  UPDATE public.trip_invitations SET token_hash = p_token_hash, status = 'pending',
    expires_at = clock_timestamp() + interval '7 days', updated_at = now()
    WHERE id = p_invitation_id;
  RETURN v_invitation.email;
END;
$$;

CREATE FUNCTION public.cancel_trip_invitation(p_trip_id uuid, p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT private.is_trip_manager(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.trip_invitations SET status = 'cancelled', updated_at = now()
    WHERE id = p_invitation_id AND trip_id = p_trip_id AND status IN ('pending', 'expired');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation cannot be cancelled' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION public.respond_to_trip_invitation(p_token text, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
  v_invitation public.trip_invitations%ROWTYPE;
  v_participant public.trip_participants%ROWTYPE;
  v_user_email text;
  v_token_hash text;
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$'
    OR p_accept IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  SELECT lower(btrim(email)) INTO v_user_email FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('status', 'unconfirmed');
  END IF;
  SELECT trip_id INTO v_trip_id FROM public.trip_invitations WHERE token_hash = v_token_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid'); END IF;
  PERFORM 1 FROM public.trips WHERE id = v_trip_id FOR UPDATE;
  SELECT * INTO v_invitation FROM public.trip_invitations
    WHERE token_hash = v_token_hash AND trip_id = v_trip_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid'); END IF;
  IF v_invitation.email <> v_user_email THEN
    RETURN jsonb_build_object('status', 'email_mismatch');
  END IF;
  IF v_invitation.status <> 'pending' THEN
    RETURN jsonb_build_object('status', CASE WHEN v_invitation.status = 'expired' THEN 'expired' ELSE 'used' END);
  END IF;
  IF v_invitation.expires_at <= clock_timestamp() THEN
    UPDATE public.trip_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  IF NOT p_accept THEN
    UPDATE public.trip_invitations SET status = 'rejected', updated_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('status', 'rejected');
  END IF;
  SELECT * INTO v_participant FROM public.trip_participants WHERE id = v_invitation.participant_id FOR UPDATE;
  IF NOT FOUND OR v_participant.role <> 'member'
    OR (v_participant.user_id IS NOT NULL AND v_participant.user_id <> auth.uid())
    OR EXISTS (SELECT 1 FROM public.trip_participants
      WHERE trip_id = v_trip_id AND user_id = auth.uid() AND id <> v_participant.id) THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;
  UPDATE public.trip_participants SET user_id = auth.uid(), status = 'active'
    WHERE id = v_participant.id;
  UPDATE public.trip_invitations SET status = 'accepted', updated_at = now() WHERE id = v_invitation.id;
  RETURN jsonb_build_object('status', 'accepted', 'trip_id', v_trip_id);
END;
$$;

CREATE FUNCTION public.remove_trip_participant(p_trip_id uuid, p_participant_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_participant public.trip_participants%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT private.is_trip_manager(p_trip_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_participant FROM public.trip_participants
    WHERE trip_id = p_trip_id AND id = p_participant_id FOR UPDATE;
  IF NOT FOUND OR v_participant.role = 'owner' THEN RETURN 'not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.expenses WHERE trip_id = p_trip_id AND paid_by_participant_id = p_participant_id)
    OR EXISTS (SELECT 1 FROM public.expense_shares WHERE trip_id = p_trip_id AND participant_id = p_participant_id)
    OR EXISTS (SELECT 1 FROM public.settlements WHERE trip_id = p_trip_id
      AND (from_participant_id = p_participant_id OR to_participant_id = p_participant_id)) THEN
    RETURN 'financial_history';
  END IF;
  DELETE FROM public.trip_participants WHERE id = p_participant_id AND trip_id = p_trip_id;
  RETURN 'removed';
END;
$$;

REVOKE ALL ON FUNCTION public.add_external_participant(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_trip_invitation(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resend_trip_invitation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_trip_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_to_trip_invitation(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_trip_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_external_participant(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip_invitation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_trip_invitation(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trip_invitation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_trip_invitation(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_trip_participant(uuid, uuid) TO authenticated;

COMMIT;
