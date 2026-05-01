# Authentication Roadmap

The current `/admin` page partitions data by a freely-typed `bank_id`
string. That's fine for an internal demo — anyone who knows your bank
id can read/write your bank. It's wrong for a real product where:

* Professors will paste their **own LLM API keys** into the agent
  settings. Those need to be scoped to a real account.
* Each professor's bank is **their data**, not a shared partition.
  We need actual access control, not just a field.

## Architecture decision: Supabase Auth

We're already using Supabase Postgres. Supabase ships with a battle-
tested auth system (signup, signin, password reset, email verification,
JWTs, OAuth providers) that plugs directly into Postgres via Row-Level
Security. No third-party service needed, no monthly fee, no rolling
our own bcrypt + JWT setup.

Other options considered:
- **Roll our own**: FastAPI + passlib + JWT. Works, but reinvents
  the wheel and becomes our ongoing security responsibility.
- **Auth0 / Clerk**: turnkey but adds a paid dependency and a third
  service to integrate. Wrong choice for a classroom-scale tool.

## What changes

### Schema

Add a `user_id` column to the `problems` table. Replace the freely-
typed `bank_id` with a combination of `(user_id, bank_name)` so each
professor can still have multiple named banks (e.g. "intro-or" and
"advanced-or") but those banks are scoped to their account.

```sql
ALTER TABLE problems ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE problems ADD COLUMN bank_name TEXT;
-- existing bank_id rows: keep as bank_name with a NULL user_id
-- (these become the "demo" public bank, readable by everyone).
```

Row-Level Security policies enforce isolation at the DB layer:
- A user can read/write rows where `user_id = auth.uid()`.
- Anyone (including unauthenticated requests) can read rows where
  `user_id IS NULL` AND `bank_name = 'demo'`.
- Nobody can write to the demo bank except via a server-side
  admin path (for seeding).

### Backend

* New dependency: `supabase` Python client (or just verify JWTs with
  PyJWT and Supabase's public key — lighter weight).
* Every `/api/admin/*` endpoint now expects an `Authorization: Bearer
  <JWT>` header. The JWT carries the user's id; the endpoint uses
  that as the implicit `user_id` for queries.
* The legacy `bank_id` parameter becomes `bank_name` (still string,
  no auth wall on it because `user_id` provides the wall).
* The team-demo `/api/educator/*` endpoints stay public — they read
  the seeded demo bank only.

### Frontend

* New dependency: `@supabase/supabase-js`. Just for client-side auth.
* New env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  Both are public (the anon key is designed to be in browser code;
  RLS does the actual security).
* New `/signin` and `/signup` pages.
* AuthProvider context holds the session, watches for token refresh,
  exposes `useAuth()` to components.
* `/admin` is gated: unauthenticated users redirect to `/signin`
  with a return URL.
* The agent settings overlay still stores the user's LLM API key
  in localStorage (we don't want it on our server), but now keys
  are namespaced by `user.id` so multiple users on the same
  browser don't share keys.
* When a logged-in user opens `/admin`, their bank picker shows
  their own banks (default: a single bank named after them). They
  can fork from `demo` as before.

### Privacy and security notes

* **LLM API keys never leave the user's browser** except in transit
  to the chosen provider. The backend proxy receives the key per
  request and never persists it. This stays the same.
* **Database access** uses Supabase RLS. Even if a malicious user
  forges requests, Postgres refuses to return another user's rows.
* **Demo bank is read-only** for unauthenticated users. The
  team-project /educator demo continues to work without forcing
  visitors to sign up.

## Slices

1. **Auth foundation**: Supabase JS client, signin/signup pages,
   AuthProvider, protected routes. No backend changes yet —
   `/admin` still works the way it does now, but it's gated by
   sign-in. Useful first because it can ship without disturbing
   the existing API.
2. **Backend JWT verification**: every `/api/admin/*` endpoint
   reads the bearer token, verifies it via Supabase's public key,
   extracts user_id. No schema changes yet — bank_id still works
   as the partition key, but now only authenticated users can hit
   the endpoints.
3. **Schema migration**: add user_id + bank_name columns to
   `problems`. Migrate existing rows: bank_id `'demo'` keeps
   user_id=NULL (public). All other existing banks get an
   `unowned` flag so the original creator can claim them after
   signing up. (Or simpler: delete them and start fresh, since
   nothing important is in them yet.)
4. **RLS policies**: enable row-level security on `problems`,
   write the read/write policies described above. Verify each
   user only sees their own data.
5. **Frontend bank UI**: replace the typed bank_id picker with
   a list of the user's banks. "Create a bank" instead of "type
   a bank id." Fork-from-demo still works.

## What it does NOT change

* The team-project /educator page. That stays unauthenticated, reads
  the public demo bank only.
* The Matrix Method workspace, the guided learn page, anything
  outside `/admin`. Those don't touch user-specific data.
* The agent endpoint shape. Still accepts a key in the request,
  still forwards to the provider.
