# TripSplit

TripSplit is a responsive Next.js application for shared trips and expenses.
Email/password authentication and user profile management are implemented with
Supabase Auth. Authenticated users can create, view, and edit trips.
Expense management screens are not implemented yet.

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
run it once. Do not run it against a project where these tables and policies
already exist: the schema setup is not intended to be rerun. Dashboard
execution does not add migration history to a CLI migration ledger.

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
  Keep monetary inputs as decimal strings and do not calculate with JavaScript
  `Number`. When doing financial calculations in a future feature, use an
  exact-decimal library or PostgreSQL numeric operations. Equal and percentage
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
and deletion can remove associated financial history. Participants, expenses,
balances and settlements management remain future features.

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
