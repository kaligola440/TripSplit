# TripSplit

TripSplit is a responsive Next.js application for shared trips and expenses.
Email/password authentication and user profile management are implemented with
Supabase Auth. Authenticated users can create, view, and edit trips.
Trip creators can manage participants and email invitations. Expense management
uses exact-decimal splits and the existing Supabase security model.

## Run the application

Use Node.js 20.9 or later and npm. Start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

The application uses the `@supabase/ssr` browser/server clients and the
Next.js 16 `proxy.ts` convention. Keep the project's public URL and publishable
key in `.env.local`; never add a service-role key to the application.

## Supabase setup

### 1. Configure the Supabase project

Use the existing Supabase project. In its dashboard, open **Connect** and copy
the project URL and **publishable** API key. Never put a database password or
service-role key in the application or in a `NEXT_PUBLIC_*` variable.

### 2. Configure local environment

In PowerShell, from the project directory, create the local environment file
only if it does not already exist:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Edit `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-sb_publishable-key
```

Use the real values from your project. The publishable key is intended for
browser use and is protected by RLS. Never put a Supabase secret/service-role
key in a `NEXT_PUBLIC_*` variable or browser code. `.env.local` is ignored by
Git.

### 3. Apply the database setup to a new project only

The versioned migrations are in `supabase/migrations/`; the matching
`supabase/manual-setup.sql` script is provided for the Dashboard SQL Editor.
For a new, empty project, open **SQL Editor**, paste that script, review it, and
run it once. Do not run the combined setup against a project where these tables
and policies already exist: it is not intended to be rerun. For an existing
Phase 4 database, apply the participant and expense migrations separately and
in order: open **SQL Editor → New query**, paste and run the entire contents of
`supabase/migrations/20261116000000_participants_invitations.sql`, then repeat
for `supabase/migrations/20261116000001_expense_management.sql`. Do not rerun
either migration after success. Their transactions roll back on failure.
Dashboard execution does not add migration history to a CLI migration ledger.
Back up the database and test on a staging project first. The migrations revoke
direct participant, expense/share, and settlement writes from `authenticated`;
older or external clients that performed those writes must use authorized RPCs
instead.

### 4. Configure authentication URLs and email

In the Supabase Dashboard, open **Authentication → URL Configuration**:

- Set **Site URL** to the actual origin used by the app. For the default local
  Next.js development server, that is `http://localhost:3000`.
- Add the exact callback URL `http://localhost:3000/auth/callback` under
  **Redirect URLs**. Add the actual application origin and its
  `/auth/callback` URL separately when configuring another environment; do not
  substitute a made-up production URL.
- Under **Authentication → Providers → Email**, enable email confirmation.
  The registration and recovery links return through `/auth/callback`.

The app constructs callback URLs from the same-origin Server Action request.
Supabase must allow the callback URL before it will redirect there.

### 5. Generate TypeScript database types

`src/types/database.types.ts` describes the existing schema. If the schema
changes later, regenerate the type file from the configured Supabase project
using the project's approved workflow and review the diff before replacing it.

## Database design and security

- The migrations create `profiles`, `trips`, `trip_participants`, `expenses`,
  `expense_shares`, and `settlements`, with constraints, indexes, defaults,
  timestamp triggers, and profile creation for new Auth users. Registration
  passes `display_name` as Auth user metadata; the existing trigger creates
  the profile. The application never inserts a second profile row.
- `private`-schema helper functions are not exposed through the Data API.
  Registered active trip participants can access trip data. Only the trip
  creator can manage participants; creators and authorized expense authors can
  manage financial records.
- External participants have a nullable `user_id`. Only an authenticated user
  ID on an active participant row grants access; an email address alone never
  grants privileges.
- Monetary columns use PostgreSQL `numeric(20,6)`, not binary floating point.
  Expense inputs remain decimal strings; the expense UI uses `BigInt` units of
  10^-6 (never JavaScript `Number`) for preview and split calculations. Equal and percentage
  splits truncate each share to six decimal places and assign the remaining
  fraction to the last participant in UUID order. A deferred constraint
  trigger verifies that all shares sum exactly to the expense total at commit.
- `create_expense_with_shares` inserts an expense and all its shares atomically.
  Call it with `p_amount` and each JSON `share_amount` encoded as decimal
  strings; the database verifies the final allocation. This prevents
  intermediate or rounded totals from being committed.
- Settlements must involve two different participants in the same trip.

## Authentication

- Registration, login, email confirmation, password recovery, reset, and
  profile updates use Supabase Auth and the server-side Supabase SSR client.
- The root `proxy.ts` refreshes/verifies Supabase claims. The profile page and
  each profile/password mutation also verify claims on the server; route
  visibility is not treated as an authorization boundary.
- Profile reads and updates use the signed-in user's ID and the existing
  `profiles` RLS policies. The service-role key is not used.
- Passwords are sent only to Supabase Auth and are never written to application
  tables or logs.
- Supabase's session lifetime is controlled by the project's Auth settings.
  There is no per-login “Remember me” override in this UI.
- The registration checkbox requires terms acceptance, but publishable Terms
  of Service and Privacy Policy content must be supplied before public launch.

## Trips

The Trips dashboard uses the signed-in user's existing RLS permissions.
The database automatically adds the creator as an active owner when a trip is
created. Only the creator with active membership can edit a trip. A start date
is required by the existing schema; destination and trip status are not stored.
Trip deletion and archiving are not offered: the schema has no archive mechanism,
and deletion can remove associated financial history. Balances and settlements
are available on each trip's detail page.

## Participants and invitations

Only an active trip creator can add external participants, invite users, resend
or cancel invitations, or remove participants. External participants have no
account access. An invitation can link an existing external participant without
losing their financial references. Removal is blocked when a participant is
referenced by an expense, expense share or settlement; keep their record to
preserve financial history. The owner cannot be removed.

Invitations expire after seven days. Tokens are random, stored only as SHA-256
hashes, and redeemed once by a user whose confirmed Supabase Auth email matches
the invitation. Resending rotates the token and invalidates the previous link.
Emails alone never grant access. RLS and database functions enforce these rules,
and serialize participant changes per trip. To avoid ambiguous legacy records,
the functions reject duplicate participant emails within a trip; resolve existing
duplicates safely before inviting those addresses.

### Invitation email configuration

Invitation delivery is separate from Supabase Auth's confirmation emails.
For real invitation emails, configure a Resend account, verify a sending domain,
and create an API key with permission to send email. Set these **server-only**
environment variables locally in `.env.local` and in Vercel for each intended
environment (never use the `NEXT_PUBLIC_` prefix):

- `TRIPSPLIT_APP_URL`: the exact application origin, e.g.
  `http://localhost:3000` for local development or your actual HTTPS production
  origin. Do not include a path or trailing slash.
- `RESEND_API_KEY`: your real Resend API key.
- `INVITATION_FROM_EMAIL`: a sender address on your verified domain.

Restart the local server after changing variables. Set `TRIPSPLIT_APP_URL`
separately for each Vercel environment to avoid sending links to the wrong
deployment. Without a configured provider, production refuses to create or
resend invitations. In `npm run dev`, if neither email credential is set, the
manager sees a private development link instead; **no email is sent**. Copy it
only to the intended recipient. A rejected or failed provider request is shown
as an error and the manager can retry with Resend. The provider accepting a
message does not guarantee delivery.

The recipient opens the invitation, signs in with the invited email address,
or registers and confirms that address first. After signing in, they must reopen
the original invitation link to accept or decline it. Keep invitation links
private. Supabase Auth's existing Site URL, callback URL and email confirmation
settings remain required; no additional Supabase redirect URL is needed.

## Expenses

Active trip participants can record expenses in the trip currency. The payer is
selected independently from the people sharing; both must be active participants
in the same trip. Expense creation, editing and deletion use authenticated
database RPCs. Split rows and the expense are written atomically, and the
existing deferred constraint validates final totals and equal/percentage
rounding. Custom amounts must sum exactly to the total; percentages must sum
exactly to 100%. Equal and percentage shares are truncated to six decimal places
in participant UUID order, with the final UUID receiving the remainder.

The expense list filters by date range, category, payer, description, and sort.
List/detail RPCs return monetary amounts as decimal text to avoid JSON numeric
conversion precision loss.

The expense migration is **required before deploying this code**. It hardens the
existing creation RPC, adds atomic save/delete and exact-text read RPCs, checks
that referenced participants are active and in the same trip, and revokes direct
expense/share writes so database functions enforce authorization on every path.
It does not recreate tables or modify the existing RLS policies.

The settlements table does not associate settlements with a specific expense.
To avoid invalidating settled balances, creating, editing, and deleting expenses
are blocked once any settlement exists for that trip. An active trip participant
may create expenses; only their creator or the trip creator can edit or delete.
This conservative lock can be replaced when a later settlement workflow models
reconciliation explicitly.

## Balances and settlements

The trip detail page shows each active or former participant's expenses paid,
expense shares owed, settlements paid and received, and final net balance.
Positive means the participant should receive money; negative means they owe
money. Monetary summaries are read as decimal text from an authenticated,
trip-scoped database function and use exact integer micro-units in the UI.
Former participants remain in the balance view when they have historical
financial records; pending invitees are excluded.

Suggested transfers use deterministic largest-balance-first matching and exact
six-decimal arithmetic to produce a compact transfer list. Any active trip
member can record a payment on behalf of participants. The database locks the
trip, recomputes both outstanding balances and rejects a payment that exceeds
either side's current balance. Payment currency is taken from the trip, and
both participants must belong to that trip. Settlement history is immutable:
direct insert, update, and delete rights are revoked, and there is no
edit/delete interface. As before, any recorded settlement locks expense
changes to avoid rewriting settled history.

The balances/settlements migration is **required before deploying this code**.
On an existing project, open **Supabase Dashboard → SQL Editor → New query**,
paste and run the complete contents of
`supabase/migrations/20261116000002_balances_settlements.sql`, after applying
the participant and expense migrations if they are not already applied. Do not
run the combined `manual-setup.sql` on an existing database; it is only for a
new, empty project. Back up the database and test the ordered migrations in a
staging project first. No migration is applied by the application.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Project structure

- `src/app/` — App Router routes and global styles
- `src/components/` — shared components
- `src/components/ui/` — reusable interface components
- `src/features/` — future feature modules
- `src/hooks/` — shared React hooks
- `src/lib/` — shared utilities
- `src/types/` — shared TypeScript types
- `supabase/migrations/` — versioned database schema and RLS migrations
