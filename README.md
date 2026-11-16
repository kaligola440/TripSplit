# TripSplit

TripSplit is a responsive web application for organizing shared trips,
participants, expenses, balances, and settlement records. It uses Next.js App
Router, React, strict TypeScript, Tailwind CSS, Lucide React, and Supabase Auth
and PostgreSQL. Server Actions and database RPCs enforce authorization and
financial rules; financial calculations use exact decimal text and integer
micro-units.

## Run the application

Use Node.js 20.9 or later and npm. Configure the required environment variables
below, then install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

The app uses the `@supabase/ssr` browser/server clients and the Next.js 16
`proxy.ts` convention. The Supabase URL and publishable key are public client
configuration protected by RLS. No service-role key is required or supported.

## Environment variables

Required in `.env.local` and in the matching Vercel environment:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key.

Required for production invitation links and email:

- `TRIPSPLIT_APP_URL` — exact site origin with no path or trailing slash.
- `RESEND_API_KEY` — private Resend API key.
- `INVITATION_FROM_EMAIL` — sender address on the verified domain.

The invitation variables must remain server-only and must never use the
`NEXT_PUBLIC_` prefix. In local development, email delivery can be omitted to
show a private development link instead; production invitations are unavailable
unless the email provider is configured. See the invitation section below.

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

### 3. Apply the database setup manually

The ordered migrations in `supabase/migrations/` are:

1. `20261114000000_initial_schema.sql`
2. `20261114000001_row_level_security.sql`
3. `20261116000000_participants_invitations.sql`
4. `20261116000001_expense_management.sql`
5. `20261116000002_balances_settlements.sql`
6. `20261116000003_trip_dashboard_overview.sql`

For a **new, empty** project only, open **Supabase Dashboard → SQL Editor**,
paste the complete `supabase/manual-setup.sql`, review it, and run it once.
Never run that combined script against an existing project or rerun it after
success.

For an existing database, first check which migrations have already been
applied. Apply only the missing files, in the order above: open **SQL Editor →
New query**, paste the complete contents of one missing migration, review and
run it, then proceed to the next. In particular, the trip overview migration
`20261116000003_trip_dashboard_overview.sql` is required for the enhanced
dashboard and must follow the balances/settlements migration. Dashboard SQL
execution does not add migration history to a CLI migration ledger. Back up
the database and test the ordered migrations in a staging project first.
Participant, expense/share, and settlement direct writes are revoked from
`authenticated`; older or external clients that performed those writes must
use the authorized RPCs instead. The app does not connect through Supabase CLI
or apply migrations automatically.

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
- Registration links to `/terms` and `/privacy`. Those routes are conspicuously
  marked as placeholders and are not publishable legal documents. Replace their
  content with owner-specific information reviewed by qualified counsel before
  public launch. The `/contact` route also requires a verified support channel.

## Trips and dashboard

The Trips dashboard uses an authenticated, read-only database function to load
trip details in batches: active participant count, exact total expenses, and
the signed-in member's net balance. It does not sum across currencies. Trip
labels are derived from start/end dates; there is no stored archive or status.
The database automatically adds the creator as an active owner when a trip is
created. Only the creator with active membership can edit a trip. A start date
is required by the existing schema; destination is not stored. Trip deletion
and archiving are not offered because deletion can remove associated financial
history. Detailed balances and settlements are available on each trip page.

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

The dashboard overview migration is also required for the `/trips` dashboard.
On an existing project where migrations 1–5 have already been applied, run
`supabase/migrations/20261116000003_trip_dashboard_overview.sql` once through
**Supabase Dashboard → SQL Editor → New query**. It adds a read-only,
authenticated RPC and does not change tables or RLS policies.

## Privacy, terms, and support

The application includes `/privacy`, `/terms`, and `/contact` pages so
registration and users have reachable information links. They deliberately
contain clearly marked placeholders, not invented owner details, contact
information, legal commitments, or reviewed policy text. Before public
availability, replace the drafts with accurate, legally reviewed content and
provide a monitored support contact. There is no account-deletion workflow.

## Production deployment on Vercel

1. Back up the database and test all missing migrations on a staging Supabase
   project. Do not run `manual-setup.sql` against an existing database.
2. Complete and review the Privacy Policy and Terms of Service, configure a
   verified support channel, and decide the data retention/request process.
3. Add the required Supabase variables to the Vercel project for the intended
   Production, Preview, and Development environments. Add all three server-only
   invitation variables in each environment where email invitations should
   work.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the
   actual production origin and allow the exact `/auth/callback` URL. Allow
   other deployment callback origins only when they are intentionally used.
   Keep email confirmation enabled and verify the configured email templates.
5. Configure the Vercel project to use the repository root, Node.js 20.9 or
   later, `npm ci` for installation, and `npm run build` for the production
   build. Confirm the lockfile is included.
6. Review environment-variable exposure, run the checks below, deploy to a
   non-public preview, and manually verify: register and confirm an account;
   create a trip; invite and accept a participant; create, edit, and delete an
   expense before settlement; verify balances and suggestions; record a
   settlement and confirm the history and expense lock; check non-member
   authorization, empty states, legal links, and mobile layouts.
7. Set `TRIPSPLIT_APP_URL` to the exact origin for each Vercel environment.
   Configure Resend with a verified sender domain and least-privilege API key.
   Invitation-provider acceptance does not guarantee delivery.

## Known limitations

- Trip status is date-derived. The schema has no archive, destination, or
  explicit completion field.
- Trips use one configured currency; cross-currency conversion and totals are
  not implemented.
- Settlement entries are immutable. Once any settlement exists, expense
  creation, editing, and deletion are blocked to protect settled history.
- Settlement suggestions are deterministic and compact, but are not guaranteed
  to find the globally minimal number of transfers for every ledger.
- The app records settlements; it does not initiate or process payments.
- There is no account deletion or self-service data export flow.
- Privacy, terms, and support content need owner completion and review.
- No external production error-monitoring provider is configured.
- The repository has Jest unit/action and PGlite migration integration tests,
  but no persistent automated browser end-to-end test harness; complete the
  preview workflow above manually before release.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

## Project structure

- `src/app/` — App Router routes and global styles
- `src/components/` — shared components
- `src/components/ui/` — reusable interface components
- `src/features/` — authentication, trips, participants, expenses, balances,
  and legal feature modules
- `src/hooks/` — shared React hooks
- `src/lib/` — shared utilities
- `src/types/` — shared TypeScript types
- `supabase/migrations/` — versioned database schema and RLS migrations
