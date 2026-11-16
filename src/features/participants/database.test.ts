import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { join } from "node:path";

jest.setTimeout(60000);

const owner = "10000000-0000-4000-8000-000000000001";
const invited = "10000000-0000-4000-8000-000000000002";
const stranger = "10000000-0000-4000-8000-000000000003";
const unconfirmed = "10000000-0000-4000-8000-000000000004";
const token = "a".repeat(43);
const nextToken = "b".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");
const nextHash = createHash("sha256").update(nextToken).digest("hex");
let db: PGlite;
let tripId: string;

async function asUser(id: string) {
  await db.exec("RESET ROLE; SET ROLE authenticated;");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
}

async function invite(email = "invitee@example.com", tokenHash = hash) {
  const result = await db.query<{ id: string }>(
    "SELECT public.create_trip_invitation($1, $2, $3, $4) AS id",
    [tripId, "Invitee", email, tokenHash],
  );
  return result.rows[0].id;
}

async function respond(invitationToken = token, accept = true) {
  const result = await db.query<{ result: { status: string; trip_id?: string } }>(
    "SELECT public.respond_to_trip_invitation($1, $2) AS result", [invitationToken, accept],
  );
  return result.rows[0].result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
  for (const migration of [
    "20261114000000_initial_schema.sql",
    "20261114000001_row_level_security.sql",
    "20261116000000_participants_invitations.sql",
  ]) {
    await db.exec(readFileSync(join("supabase", "migrations", migration), "utf8"));
  }
});

beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE auth.users CASCADE;");
  await db.query(
    `INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
     VALUES ($1, 'owner@example.com', now(), '{"display_name":"Owner"}'),
            ($2, 'invitee@example.com', now(), '{"display_name":"Invitee"}'),
            ($3, 'stranger@example.com', now(), '{"display_name":"Stranger"}'),
            ($4, 'pending@example.com', NULL, '{"display_name":"Unconfirmed"}')`,
    [owner, invited, stranger, unconfirmed],
  );
  await asUser(owner);
  const result = await db.query<{ id: string }>(
    "INSERT INTO public.trips(name, start_date, currency, created_by) VALUES ('Test trip', '2027-01-01', 'EUR', $1) RETURNING id",
    [owner],
  );
  tripId = result.rows[0].id;
});

afterAll(async () => { await db.close(); });

describe("invitation migration against PostgreSQL", () => {
  it("adds external participants without granting access and blocks duplicates and direct writes", async () => {
    await db.query("SELECT public.add_external_participant($1, $2, $3)", [tripId, "Guest", " Guest@Example.com "]);
    const participants = await db.query<{ user_id: string | null; status: string }>(
      "SELECT user_id, status FROM public.trip_participants WHERE email = 'guest@example.com'",
    );
    expect(participants.rows).toEqual([{ user_id: null, status: "active" }]);
    await expect(db.query("SELECT public.add_external_participant($1, $2, $3)", [tripId, "Again", "guest@example.com"])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("INSERT INTO public.trip_participants(trip_id, user_id, display_name) VALUES ($1, $2, 'Bypass')", [tripId, invited])).rejects.toMatchObject({ code: "42501" });
    await asUser(invited);
    expect((await db.query("SELECT id FROM public.trips WHERE id = $1", [tripId])).rows).toHaveLength(0);
    await expect(db.query("SELECT public.add_external_participant($1, $2, $3)", [tripId, "Unauthorized", "x@example.com"])).rejects.toMatchObject({ code: "42501" });
  });

  it("stores only a protected hash, blocks duplicates, and activates only the confirmed matching account", async () => {
    await invite();
    await expect(invite()).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("SELECT token_hash FROM public.trip_invitations")).rejects.toMatchObject({ code: "42501" });
    await asUser(stranger);
    expect((await respond()).status).toBe("email_mismatch");
    await expect(db.query("SELECT public.cancel_trip_invitation($1, $2)", [tripId, "00000000-0000-4000-8000-000000000001"])).rejects.toMatchObject({ code: "42501" });
    await asUser(invited);
    expect((await respond(hash)).status).toBe("invalid");
    expect(await respond()).toEqual({ status: "accepted", trip_id: tripId });
    expect((await respond()).status).toBe("used");
    expect((await db.query("SELECT id FROM public.trips WHERE id = $1", [tripId])).rows).toHaveLength(1);
    await expect(db.query("SELECT public.add_external_participant($1, $2, $3)", [tripId, "Unauthorized", "x@example.com"])).rejects.toMatchObject({ code: "42501" });
  });

  it("links an existing external participant instead of creating a duplicate", async () => {
    const external = await db.query<{ id: string }>("SELECT public.add_external_participant($1, 'Guest', 'invitee@example.com') AS id", [tripId]);
    await invite();
    await asUser(invited);
    expect((await respond()).status).toBe("accepted");
    const participants = await db.query<{ id: string; user_id: string }>("SELECT id, user_id FROM public.trip_participants WHERE email = 'invitee@example.com'");
    expect(participants.rows).toEqual([{ id: external.rows[0].id, user_id: invited }]);
  });

  it("allows an invited new user to register, confirm and then accept", async () => {
    await invite("new@example.com");
    const newUser = "10000000-0000-4000-8000-000000000005";
    await db.exec("RESET ROLE");
    await db.query("INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data) VALUES ($1, 'new@example.com', now(), '{\"display_name\":\"New user\"}')", [newUser]);
    await asUser(newUser);
    expect(await respond()).toEqual({ status: "accepted", trip_id: tripId });
    expect((await db.query("SELECT id FROM public.trips WHERE id = $1", [tripId])).rows).toHaveLength(1);
  });

  it("requires a confirmed email and supports rejection, cancellation and rotated links", async () => {
    const invitationId = await invite("pending@example.com");
    await asUser(unconfirmed);
    expect((await respond()).status).toBe("unconfirmed");
    await db.exec("RESET ROLE");
    await db.query("UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1", [unconfirmed]);
    await asUser(unconfirmed);
    expect((await respond(token, false)).status).toBe("rejected");
    expect((await respond()).status).toBe("used");
    await asUser(owner);
    await expect(db.query("SELECT public.resend_trip_invitation($1, $2, $3)", [tripId, invitationId, nextHash])).rejects.toMatchObject({ code: "22023" });
    const other = await invite("invitee@example.com", nextHash);
    await db.query("SELECT public.cancel_trip_invitation($1, $2)", [tripId, other]);
    await asUser(invited);
    expect((await respond(nextToken)).status).toBe("used");
  });

  it("expires invitations, refreshes the deadline on resend, and invalidates the old token", async () => {
    const invitationId = await invite();
    await db.exec("RESET ROLE");
    await db.query("UPDATE public.trip_invitations SET expires_at = now() - interval '1 second' WHERE id = $1", [invitationId]);
    await asUser(invited);
    expect((await respond()).status).toBe("expired");
    await asUser(owner);
    await db.query("SELECT public.resend_trip_invitation($1, $2, $3)", [tripId, invitationId, nextHash]);
    const deadlines = await db.query<{ valid: boolean }>(
      "SELECT expires_at > now() + interval '6 days 23 hours' AND expires_at <= now() + interval '7 days 1 minute' AS valid FROM public.trip_invitations WHERE id = $1", [invitationId],
    );
    expect(deadlines.rows[0].valid).toBe(true);
    await asUser(invited);
    expect((await respond()).status).toBe("invalid");
    expect((await respond(nextToken)).status).toBe("accepted");
  });

  it("permits only one of simultaneous acceptance requests on the test connection", async () => {
    await invite();
    await asUser(invited);
    const results = await Promise.all([respond(), respond()]);
    expect(results.map((result) => result.status).sort()).toEqual(["accepted", "used"]);
    expect((await db.query("SELECT id FROM public.trip_participants WHERE trip_id = $1 AND user_id = $2", [tripId, invited])).rows).toHaveLength(1);
  });

  it("prevents owner removal and retains participants referenced by expenses", async () => {
    const added = await db.query<{ id: string }>("SELECT public.add_external_participant($1, 'Guest', 'guest@example.com') AS id", [tripId]);
    const participantId = added.rows[0].id;
    const ownerParticipant = await db.query<{ id: string }>("SELECT id FROM public.trip_participants WHERE trip_id = $1 AND role = 'owner'", [tripId]);
    await db.exec("RESET ROLE; SET session_replication_role = replica;");
    await db.query(
      `WITH expense AS (
        INSERT INTO public.expenses(trip_id, description, amount, currency, expense_date, paid_by_participant_id, created_by)
        VALUES ($1, 'Lunch', 12, 'EUR', '2027-01-01', $2, $3) RETURNING id
      ) INSERT INTO public.expense_shares(expense_id, trip_id, participant_id, share_amount, share_type)
        SELECT id, $1, $2, 12, 'custom' FROM expense`,
      [tripId, participantId, owner],
    );
    await db.exec("SET session_replication_role = origin;");
    await asUser(owner);
    const blocked = await db.query<{ result: string }>("SELECT public.remove_trip_participant($1, $2) AS result", [tripId, participantId]);
    expect(blocked.rows[0].result).toBe("financial_history");
    const blockedOwner = await db.query<{ result: string }>("SELECT public.remove_trip_participant($1, $2) AS result", [tripId, ownerParticipant.rows[0].id]);
    expect(blockedOwner.rows[0].result).toBe("not_allowed");
    expect((await db.query("SELECT id FROM public.trip_participants WHERE id = $1", [participantId])).rows).toHaveLength(1);
  });

  it("removes a participant with no financial history and revokes their access", async () => {
    await invite();
    await asUser(invited);
    expect((await respond()).status).toBe("accepted");
    await asUser(owner);
    const participants = await db.query<{ id: string }>("SELECT id FROM public.trip_participants WHERE trip_id = $1 AND user_id = $2", [tripId, invited]);
    const result = await db.query<{ result: string }>("SELECT public.remove_trip_participant($1, $2) AS result", [tripId, participants.rows[0].id]);
    expect(result.rows[0].result).toBe("removed");
    await asUser(invited);
    expect((await db.query("SELECT id FROM public.trips WHERE id = $1", [tripId])).rows).toHaveLength(0);
    expect((await respond()).status).toBe("invalid");
  });
});
