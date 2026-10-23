# Partner sign-in and development preview

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
| `src/features/partner/partnerDemoPreviewState.ts` | Explicit development flag and independent preview context |
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

## Development preview behavior

Preview requires **both** `import.meta.env.DEV` and
`VITE_ENABLE_PARTNER_DEMO === 'true'`. It is off without explicit opt-in and always
off in production builds, even when the flag is set and a marker is present.
Copy `.env.example` to `.env.local`, then restart Vite to enable local previews.

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
6. Remove/disable development demo access before production deployment.

## Validation

From `frontend`, run `npm.cmd run build`, `npm.cmd run lint`, and
`node --test tests/partnerAuthentication.test.mjs tests/partnerAnalytics.test.mjs tests/votingSession.test.mjs tests/votingResults.test.mjs tests/restaurantPreferences.test.mjs`.

The partner browser suite needs three servers, each in its own terminal:

```powershell
# Terminal 1: explicitly enabled development
$env:VITE_ENABLE_PARTNER_DEMO='true'
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort

# Terminal 2: disabled development
$env:VITE_ENABLE_PARTNER_DEMO='false'
npm.cmd run dev -- --host 127.0.0.1 --port 5187 --strictPort

# Terminal 3: production, with the opt-in deliberately set to test the override
$env:VITE_ENABLE_PARTNER_DEMO='true'
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 5188 --strictPort

# Terminal 4
node tests/partnerAnalytics.browser.mjs
```

Installed Chrome and Node 24 are used without added dependencies. Override paths
and URLs using `CHROME_PATH`, `FORKOFF_TEST_URL`, `FORKOFF_DISABLED_TEST_URL`, and
`FORKOFF_PRODUCTION_TEST_URL`. The suite prints its screenshot/CSV directory.

Coverage includes validation/focus, show/hide, unavailable sign-in/no credential
storage, busy/disabled/error states, duplicate prevention and cancellation,
direct-entry guard, explicit preview entry, exit/history/refresh, blocked storage,
disabled development and production with seeded markers, keyboard use, 200% text,
320–1920px layouts, existing analytics/CSV behavior, and all nine consumer screens.
The deferred adapter test only rejects requests; it never simulates successful
password authentication.

Verified for this change: TypeScript/Vite production build and lint passed;
all 21 Node tests and 143 partner browser checks passed. The existing navigation
and Results suites passed 49 and 56 checks respectively. All nine consumer routes
rendered in the partner regression suite. Desktop and 320px screenshots were
also inspected. No backend, dependency, consumer-screen, or analytics-calculation
changes were made; existing uncommitted header/navigation work was preserved.

## Files changed by this task

Created:

- `.env.example`
- `docs/partner-authentication.md`
- `src/features/partner/partnerAuthentication.ts`
- `src/features/partner/usePartnerSignIn.ts`
- `src/features/partner/partnerDemoPreviewState.ts`
- `src/features/partner/PartnerDemoPreview.tsx`
- `tests/partnerAuthentication.test.mjs`

Updated (including partner files already present as uncommitted work):

- `README.md`
- `src/features/partner/PartnerAccountAccess.tsx`
- `src/pages/PartnerAccessPage.tsx` and `PartnerAccessPage.css`
- `src/pages/PartnerRestaurantPage.tsx` and `PartnerRestaurantPage.css`
- `src/routes/routes.tsx` and `paths.ts`
- `tests/partnerAnalytics.browser.mjs`
