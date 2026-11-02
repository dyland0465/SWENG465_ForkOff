# Partner sign-in and demo preview

`/partners` has email/password validation, accessible labels and errors, password
visibility, busy/disabled/error states, and Home navigation. The existing orange,
navy, warm-background tokens and shared fields/buttons are reused. Submitting
valid fields always reports that live authentication is unavailable. It does not
compare credentials, call a backend, create an account, or authenticate anyone.

## Integration map

| File | Responsibility |
| --- | --- |
| `src/features/partner/PartnerAccountAccess.tsx` | Primary integration boundary: sign-in fields and validation |
| `src/features/partner/usePartnerSignIn.ts` | Request/account state, duplicate prevention, cancellation, safe error messages |
| `src/features/partner/partnerAuthentication.ts` | Replaceable backend service contract and unavailable adapter |
| `src/features/partner/partnerDemoPreviewState.ts` | Explicit development/staging opt-in and independent preview context |
| `src/features/partner/PartnerDemoPreview.tsx` | Tab-scoped preview state and demonstration route guard |
| `src/routes/routes.tsx` | Partner-only provider and guarded analytics route |
| `src/pages/PartnerRestaurantPage.tsx` | Existing synthetic analytics presentation with preview labeling/exit |

`PartnerAuthenticationService` defines `signIn(credentials, signal)`,
`verifySession(signal)`, and `signOut(signal)`. `PartnerSession` reserves
server-verified partner ID, role, authorized restaurant IDs, and expiration
metadata. It contains no password or session token. Currently sign-in rejects,
verification returns null, and sign-out has no session to invalidate. The form
keeps credentials only in component/request memory and aborts requests on unmount.

The verified account state is reserved for a future real adapter. It never
activates demo preview or grants access to a private analytics route. No real
session lifecycle, authenticated route, or private data fetching is implemented.

## Demo preview behavior

Preview requires `VITE_ENABLE_PARTNER_DEMO === 'true'` and either Vite development
mode or `VITE_APP_ENV === 'staging'`. It is off without explicit opt-in. Optimized
builds with a missing/other environment value stay disabled, even with the flag
set and a marker present. Docker defaults to `production` / `false`.
Copy `.env.example` to `.env.local`, then restart Vite to enable local previews.
For hosted staging, follow the [Coolify deployment guide](partner-demo-staging.md),
including mandatory server-side proxy authentication. Frontend flags are public
build-time settings and cannot protect access.

The Preview action stores only `active` under
`forkoff.partner-demo-preview.v1` in sessionStorage. It needs no password and
represents no verified session. It preserves access through Home navigation,
Back/Forward, and refresh in the current tab. Browsers can copy sessionStorage
when duplicating a tab; the marker has no authentication meaning.

Without active preview, `/partners/:restaurantId` redirects to `/partners` with
history replacement. Exit clears the marker and in-memory preview and returns
to Access; history cannot restore exited access. If storage is blocked, in-memory
entry/exit works, but refresh requires entering preview again. The dashboard and
CSV label all data synthetic. Its calculations and fixture data are unchanged.
The frontend route guard is demonstration UX, never a security boundary.

## Backend handoff requirements

1. Replace the unavailable adapter with real Express sign-in, session, and logout
   endpoints. Use secure server-validated sessions, such as Secure/HttpOnly cookies
   with an appropriate SameSite/CSRF policy. Do not store passwords or session
   tokens in browser storage.
2. Move verified account state to an application-scoped session provider when
   integrating real accounts. Verify on bootstrap, handle expiration and 401 by
   clearing state, and invalidate the server session on sign-out. Preview exit
   is separate from sign-out.
3. Add a verified-session route guard for private dashboards, with an authorized
   restaurant scope (for example `/partner-portal/restaurants/:restaurantId`).
   This namespace is not implemented. Keep demo state independent of sessions.
4. Associate partners with authorized restaurant records. The backend must verify
   partner role and restaurant ownership/authorization for **every** private
   analytics request. Reject access to other restaurants even when URL/request IDs
   change. Frontend session metadata and route guards are only UI conveniences.
5. Supply authorized analytics through backend requests. Never bundle real private
   analytics in public frontend assets or put real records in synthetic fixtures.
   Keep the existing reporting calculations/presentation separate from access.
6. Keep demo access disabled in real production. Hosted staging requires separate
   server-side deployment protection as documented in the Coolify guide.

## Validation

From `frontend`, run `npm.cmd run build`, `npm.cmd run lint`, and
`node --test tests/partnerAuthentication.test.mjs tests/partnerAnalytics.test.mjs tests/votingSession.test.mjs tests/votingResults.test.mjs tests/restaurantPreferences.test.mjs`.

The partner browser suite uses this server/build matrix. Run each server in its
own terminal from `frontend`; keep the output directories separate. All optimized
builds use the normal production build mode and keep `NODE_ENV=production`.

```powershell
# Terminal 1: explicitly enabled development
$env:VITE_ENABLE_PARTNER_DEMO='true'
$env:VITE_APP_ENV='development'
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort

# Terminal 2: disabled development
$env:VITE_ENABLE_PARTNER_DEMO='false'
$env:VITE_APP_ENV='development'
npm.cmd run dev -- --host 127.0.0.1 --port 5187 --strictPort

# Terminal 3: real production rejects the demo flag on its own
$env:NODE_ENV='production'
$env:VITE_APP_ENV='production'
$env:VITE_ENABLE_PARTNER_DEMO='true'
npm.cmd run build -- --outDir dist/production-flag
npm.cmd run preview -- --outDir dist/production-flag --host 127.0.0.1 --port 5188 --strictPort

# Terminal 4: explicitly enabled optimized staging
$env:NODE_ENV='production'
$env:VITE_APP_ENV='staging'
$env:VITE_ENABLE_PARTNER_DEMO='true'
npm.cmd run build -- --outDir dist/staging
npm.cmd run preview -- --outDir dist/staging --host 127.0.0.1 --port 5189 --strictPort

# Terminal 5: real production with the Dockerfile's default settings
$env:NODE_ENV='production'
$env:VITE_APP_ENV='production'
$env:VITE_ENABLE_PARTNER_DEMO='false'
npm.cmd run build -- --outDir dist/production-default
npm.cmd run preview -- --outDir dist/production-default --host 127.0.0.1 --port 5190 --strictPort

# Terminal 6: optimized staging without demo opt-in
$env:NODE_ENV='production'
$env:VITE_APP_ENV='staging'
$env:VITE_ENABLE_PARTNER_DEMO='false'
npm.cmd run build -- --outDir dist/staging-disabled
npm.cmd run preview -- --outDir dist/staging-disabled --host 127.0.0.1 --port 5191 --strictPort

# Terminal 7: focused flag/guard/sign-in checks against the compiled bundles
node tests/partnerAnalytics.browser.mjs --demo-builds-only
# Full historical UI/analytics/consumer regression suite
node tests/partnerAnalytics.browser.mjs
```

Installed Chrome and Node 24 are used without added dependencies. Override paths
and URLs using `CHROME_PATH`, `FORKOFF_TEST_URL`, `FORKOFF_DISABLED_TEST_URL`, and
`FORKOFF_PRODUCTION_TEST_URL`, `FORKOFF_STAGING_TEST_URL`,
`FORKOFF_PRODUCTION_DEFAULT_TEST_URL`, and `FORKOFF_STAGING_DISABLED_TEST_URL`.
The suite prints its screenshot/CSV directory. Local preview servers are for
validation only; hosted staging uses the protected Coolify deployment.

Coverage includes validation/focus, show/hide, unavailable sign-in/no credential
storage, busy/disabled/error states, duplicate prevention and cancellation,
direct-entry guard, explicit preview entry, exit/history/refresh, blocked storage,
disabled development, production and staging without opt-in with seeded markers,
optimized staging entry/sign-in/exit/refresh/blocked storage, keyboard use, 200% text,
320–1920px layouts, existing analytics/CSV behavior, and all nine consumer screens.
The deferred adapter test only rejects requests; it never simulates successful
password authentication.

### Validation results (2026-10-30)

The normal TypeScript/Vite build and all four optimized build configurations
above passed. Lint passed without warnings. All 21 frontend Node tests and the
existing backend test (`cd ../backend; npm.cmd test`) passed. The focused browser
command passed **26 checks**, including an actual staging CSV download matched
against the synthetic report, unknown restaurant scopes, and refresh without
storage. It allows the existing consumer `/api/auth/session` bootstrap request;
the partner demo/sign-in makes no partner API or external requests.

All six existing full browser suites were also run. They currently fail against
the repository's existing consumer UI:

| Suite | Failure |
| --- | --- |
| `partnerAnalytics.browser.mjs` | After 13 passing access/sign-in checks, expects the removed Home "For Restaurants" header link; the current header has "Log in" |
| `lobby.browser.mjs` | Looks for an absent lobby control after four passing layout checks; current live lobby requests have no running backend |
| `navigation.browser.mjs` | Looks for the absent lobby filter editor in the current live lobby UI |
| `restaurantPreferences.browser.mjs` | Looks for the absent lobby filter editor in the current live lobby UI |
| `results.browser.mjs` | Voting fails with the existing missing `RestaurantPreferencesProvider`, then the voting control lookup fails after the initial Results check |
| `restaurantDetails.browser.mjs` | Returning to Voting hits the same missing provider, then a control lookup fails after 16 passing Details checks |

Those consumer components and historical assertions were not changed by the
staging update. The header link and preferences provider are already absent from
the rendered `HEAD` layout, and the older lobby tests assume local demo controls
rather than the current live backend. Passing the focused staging checks does
not mean the full browser suites pass.
Refreshing installed frontend dependencies from the existing lockfile resolved
a missing `socket.io-client` build dependency. Two unused declarations in
`AppLayout.tsx` were removed to unblock TypeScript; rendering is unchanged.

The Docker CLI is unavailable locally, so the container image was not built.
The Coolify deployment and mandatory proxy protection have not been configured
or verified from this workspace. Follow the staging guide's deployment and
external access checks before sharing the hosted preview.
