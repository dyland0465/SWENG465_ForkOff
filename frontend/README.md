# Fork Off! frontend

React + TypeScript + Vite, with plain CSS and the Fork Off Figma design system.

## Partner Access navigation

From Home, choose **For Restaurants** in the header to open `/partners`.
The sign-in card validates required email/password fields and email format,
supports password show/hide, and has accessible errors and request states.
Valid submission explains that live authentication is not connected; it never
signs anyone in. **Back to Home** and the shared Home/brand links return to `/`.

Demo access is off by default. To opt in locally, copy `.env.example` to
`.env.local` and restart Vite, or run from `frontend`:

```powershell
$env:VITE_ENABLE_PARTNER_DEMO='true'
npm.cmd run dev
```

Open `/partners` on the printed Vite URL and choose **Preview Demo Dashboard**.
No password is needed. A separate tab-scoped preview marker preserves access
across navigation/refresh. Direct dashboard entry without it redirects to
`/partners`. **Exit demo preview** clears access and returns there. Production
builds always disable preview, even with the flag set and a stored marker.

`src/features/partner/PartnerAccountAccess.tsx` is the future authentication
integration boundary. The form, request/account state, authentication adapter,
demo-preview state/guard, and analytics presentation are separate. Credentials
remain only in the mounted form/request, never browser storage or logs. The
dashboard continues to use only `demoPartnerAnalytics.ts` synthetic fixtures.
See [Partner authentication handoff](docs/partner-authentication.md) for the
service contracts, session lifecycle requirements, route behavior, and tests.

Backend integration requirements:

- Replace the placeholder adapter with real Express sign-in, secure server-validated
  session verification, sign-out, and expiration handling. Associate partners with
  authorized restaurant records; the handoff describes the integration points.
- Enforce partner role and restaurant ownership/authorization on the backend for
  every private analytics request. A frontend guard/restaurant ID is not security.
  Prevent cross-restaurant access, including modified URLs and request IDs.
- Disable/remove demo access before deployment. Never bundle actual private
  analytics into public frontend assets or replace synthetic fixtures with them.

`node tests/partnerAnalytics.browser.mjs` checks sign-in, demo guards, production
restrictions, history/refresh, keyboard focus, 320–1920px layouts, analytics/CSVs,
and all nine consumer routes. It uses installed Chrome and Node 24 and prints
a temporary artifact directory. It requires enabled/disabled development servers
and a production preview server; setup and URL overrides are in the handoff.

## Partner Analytics

Enable development preview as described above, start Vite, then enter via
**Preview Demo Dashboard** on `/partners`.
The established `/partners/:restaurantId` route now implements
[Figma Partner Analytics, 33:119](https://www.figma.com/design/NGidWJoB9QBFCdTd7U4BlQ/FORKOFF-?node-id=33-119).
It has a separate partner header, four metric cards, a vote distribution chart,
an expandable accessible data table, promotion engagement, and a privacy panel.
It reuses Button, SelectField, TextAction, the foundation tokens, and self-hosted
Atkinson Hyperlegible. The partner design contains no image or SVG assets.

**Development preview only; no authenticated partner access.** Harbor & Hearth
is the only analytics fixture. Other restaurant IDs show an empty report and an
explicit link to this demo. No consumer vote/preference state is used or changed.
Reporting controls select 30 or 7 sample days ending **September 8, 2026**, or an
empty June period. Dates stay fixed and do not imply live or current reporting.
Changing periods updates all metrics, chart values, promotion figures, and the
screen-reader status. Overview and Promotions focus their sections; Support
opens local guidance and restores focus when closed.

`src/features/partner/demoPartnerAnalytics.ts` owns synthetic daily aggregates,
report projection, rates, previous-period comparisons, and CSV serialization.
Weekly buckets follow the Figma chart (135/170/188/219 Yes votes); the last
bucket covers nine days, with precise dates in the table and CSV. Headline Yes
votes and veto rate are derived from those same rows (712 and 10.1%) because the
mockup's 3,842 and 3.2% disagree with its chart. Veto rate divides Veto by all
Yes/No/Veto votes; promotion CTR divides clicks by views. Trends compare the
preceding period of equal length. The chart states its scale, which adapts to
daily or weekly counts while staying common across all series in a report.

Export CSV downloads only the displayed sample period: summary metrics, exact
vote bucket ranges/counts, and promotion views/clicks/CTR. Every row labels the
synthetic source, restaurant, and report dates. Prior comparison rows are not
exported. Empty reports show unavailable metrics and disable export. Controls
reset on refresh; only the separate preview marker persists in this tab.
Desktop geometry follows the 1440px
Figma layout, with responsive adaptations through 320–1920px.

Future backend work must supply authenticated partner sessions, server-side
restaurant authorization, privacy-safe aggregate APIs, reporting-period and
comparison semantics, and persistence. This frontend does not authenticate,
query MongoDB, manage restaurants/promotions, or call external services.

Validation (browser checks require the three servers described in the handoff
and installed Chrome):

```powershell
npm.cmd run build
npm.cmd run lint
node --test tests/partnerAuthentication.test.mjs tests/partnerAnalytics.test.mjs tests/votingSession.test.mjs tests/votingResults.test.mjs tests/restaurantPreferences.test.mjs
node tests/partnerAnalytics.browser.mjs
```

The Partner browser suite checks actual CSV downloads, chart/metric consistency,
keyboard controls, empty/unknown scopes, route focus and history, all nine
consumer routes, and both populated periods at eight widths from 320 to 1920px.
It writes screenshots and downloaded CSVs to a printed system temporary directory.
Existing Lobby, navigation, Results, Details, and shared-preferences browser
suites remain separate regression checks. No dependencies or backend changes.

## Shared restaurant preferences

Lobby, Discovery Preview, and Voting read `useRestaurantPreferences(lobbyId)`.
`RestaurantPreferencesProvider` lives in `AppLayout`, alongside the independent
voting provider. Its reducer stores immutable snapshots in nested maps by the exact
router-decoded lobby ID and optional round ID (`null` for current local settings).
Client-side links and browser Back/Forward read the latest selections; history
does not restore old filter snapshots. Refresh clears this memory-only state.
There is no storage, group synchronization, restaurant search, or API integration.

`src/features/preferences/restaurantPreferences.ts` owns the shared model,
options, defaults, validation, formatting, and pure reducer. Both screens use
`RestaurantFilterEditor`, the existing form hook, FormField, and FilterChip.
Apply validates and saves the whole draft; Cancel discards only the draft.
Prices and cuisines remain multi-select arrays, and dining needs are preserved.
Availability distinguishes **Any availability**, **Open now**, and **Open at
dining time** instead of relabeling scheduled availability as open now.
Dates use `YYYY-MM-DD` and times use `HH:mm` as local calendar values without
timezone conversion. A blank date/time means any date/time; scheduled availability
does not invent a missing date or time. These demo preferences do not reject past
dates or change themselves when the clock advances. Create/Join retain their
existing independent form behavior and backend boundaries.

Reset on either screen restores **all** defaults for that lobby: Erie, PA;
any date; 7:30 PM; within 5 miles; rating 4.0+; Italian and Ramen; $$;
Mocktails; open at dining time. Empty selections mean any cuisine/price or no
dining needs. Voting displays the current preferences, including after completion,
without claiming sample restaurants meet them. Cards, votes, Undo, Restart, and
Results remain independent of filter edits and Reset.

A future backend adapter can validate hydrated settings at `preferencesFromFields`
and apply them within the same lobby/round scope. Before real rounds are supported,
the product/backend must define whether filters lock once voting begins or changes
create a new versioned round, and how existing votes are retained or invalidated.
This implementation does not select that policy, start rounds, or clear votes on edits.

Focused checks (with Vite running on port 5175 for the browser check):

```powershell
node --test tests/restaurantPreferences.test.mjs
node tests/restaurantPreferences.browser.mjs
```

The full preference summary uses normal text flow: the default Voting card grows
from 583px to 602px tall while retaining its desktop columns and 620px by 520px
photo. Older temporary scripts that assert the original fixed card height need
that expectation updated; longer selections can grow the card further.

Files created for this change:

- `src/features/preferences/restaurantPreferences.ts`
- `src/features/preferences/RestaurantPreferencesProvider.tsx`
- `src/features/preferences/useRestaurantPreferences.ts`
- `src/features/preferences/RestaurantFilterEditor.tsx`
- `tests/restaurantPreferences.test.mjs`
- `tests/restaurantPreferences.browser.mjs`

Files modified: `src/components/layout/AppLayout.tsx`,
`src/components/lobby/lobbyForm.ts`, `src/pages/LobbyPage.tsx`,
`src/pages/DiscoveryPreviewPage.tsx`, `src/pages/VotingPage.tsx`, the three
corresponding page CSS files, `tests/lobby.browser.mjs` (native date focus
expectations), and this README. Backend files and dependencies are unchanged.

Validation: TypeScript/Vite build and lint passed; all 15 unit tests passed;
the four existing repository browser suites passed (94 Lobby accessibility,
49 navigation/focus, 56 Results, 54 Restaurant Details checks). The focused
shared-preferences browser suite passed 46 checks, including empty selections,
multiple prices, dates/times, Apply/Cancel, both Resets, Back/Forward, encoded
IDs, independent lobbies, retained votes, Undo, Restart, Results, keyboard
focus, refresh, and responsive layouts at 320/375/768/1440px. The existing
temporary consumer/chat regression suite also passed 58 checks. The older
temporary Voting suite stops at its fixed 583px card-height assertion described
above; its remaining assertions were not reached.

## Results and Final Choice

Start Vite with `npm.cmd run dev` from `frontend`, open
`/lobbies/demo-crew/voting`, process all three restaurants, and choose
**View your results**. Direct access to `/lobbies/demo-crew/results` shows an
empty session with a Start voting link. An incomplete session shows its existing
decisions and a Continue voting link.

The screen follows [Figma Results, 33:106](https://www.figma.com/design/NGidWJoB9QBFCdTd7U4BlQ/FORKOFF-?node-id=33-106),
using the shared buttons, text actions, tokens, font, header, and restaurant photos.
The desktop list and selected card use the original 760px/460px columns and 60px
gap; the selected photo uses the original 460 × 220 cover slot. Existing local
ramen and wordmark assets were verified byte-for-byte against the Results assets.
The layout stacks on smaller screens and supports 320px through 1920px.

`src/features/voting/votingResults.ts` projects the existing per-lobby session:

- Yes choices share rank 1 and are eligible for explicit demo selection. Display
  ties retain Voting order; no rating or distance is used to invent a preference.
- No and Veto remain distinct and are ineligible. Skips advance progress but
  never count as votes. Unreviewed restaurants have no decision or rank.
- Counts reflect only the current user's local decisions. The three existing
  fixtures replace the mockup's five finalists and invented group percentages.
- A final selection requires clicking Choose. The `selection` query parameter
  preserves that choice through browser Back/Forward, and is accepted only for
  a current Yes choice. It never restores votes after refresh or restart.

Restaurant names and **View restaurant details** open the matching shared entry.
Details opened from Results offer **Return to results**, preserving selection;
Details opened from Voting continue to return to Voting. **Return to Lobby** and
**Review filters** retain the dynamic lobby ID. **Restart Voting** immediately
clears only that lobby's local session and opens Voting. Browser Back cannot
restore reset votes. The existing provider remains unchanged and clears on refresh.

**Full results** focuses the ranking. **Share** uses native sharing or a clipboard
fallback for a labeled demonstration choice; it includes no private votes or
lobby ID. **Directions** explains that verified navigation is unavailable.
Real group consensus, group vote aggregation, verified restaurant services, and
server persistence remain backend dependencies. No group winner, matching
algorithm, or roulette fallback is implemented.

Validation from `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
node --test tests/votingSession.test.mjs tests/votingResults.test.mjs
```

For browser checks, run Vite with
`npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort`, then
`node tests/results.browser.mjs`. This uses installed Chrome, Node 24 and DevTools
port 9237, supports `CHROME_PATH` and `FORKOFF_TEST_URL`, and saves screenshots to
the system temporary directory. Unit coverage includes all 64 combinations of
Yes/No/Veto/Skip, empty and incomplete sessions, undo and restart. Browser coverage
includes completion, selection, Details round trips, encoded IDs, Back/Forward,
independent lobbies, all-rejected/all-skipped sessions, sharing, focus, local
assets, and responsive layouts. Existing Details, Voting, Discovery and consumer
route/chat regression checks were also run. Older temporary scripts that expected
Voting, Details or Results placeholders require the implemented-screen expectations.

## Restaurant Details

Open `/lobbies/demo-crew/voting`, choose **View restaurant details**, then
**Return to voting**. Direct links also work, for example
`/lobbies/demo-crew/restaurants/ramen`. Supported restaurant IDs are `ramen`,
`harbor`, and `bowls`; unknown and missing IDs offer a return to the same lobby's
Voting screen.

The Details screen uses the shared `demoRestaurants.ts` fixtures and the original
Figma imagery. North Pier Ramen's address and hours are explicitly sample data;
the other restaurants show unavailable fields. The About disclosure contains
sample details. Menu, Website, Call, and Directions display local notices because
verified service data and integrations are unavailable. The map is static.

Voting choices survive client-side navigation and browser Back/Forward in the
existing provider. Refresh clears these memory-only demo choices. Live restaurant
data, menus, verified contact links, routing, and server persistence remain
backend dependencies. Partner Analytics is available as the development preview above.

Validation:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
node --test tests/votingSession.test.mjs
```

For the dependency-free browser integration check, start Vite in one terminal
with `npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort`, then run
`node tests/restaurantDetails.browser.mjs` from `frontend` in another terminal.
The check uses installed Chrome, Node 24, and DevTools port 9233. Set `CHROME_PATH`
to override the Windows Chrome executable, or `FORKOFF_TEST_URL` to override the
server URL. Screenshots are written to the system temporary directory.

## Preview

From the repository root:

```powershell
cd frontend
npm.cmd run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).
On macOS/Linux, use `npm` in place of `npm.cmd`. If dependencies have not yet
been installed, run `npm.cmd ci` first.

To preview the production build, run `npm.cmd run build`, then
`npm.cmd run preview` and open the URL printed by Vite.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
```

The build includes TypeScript checking. Focused Node and Chrome suites are
documented above and in the partner authentication handoff.

## Current scope

- `src/styles/tokens.css`: all foundation colors and semantic aliases, the six
  typography styles, spacing, radii, shadows, and keyboard focus tokens.
- `src/index.css`: self-hosted fonts and global base styles.
- `src/components/ui`: typed Button and TextAction components with native
  HTML behavior, plus a native modal Dialog.
- `src/components/layout/AppHeader`: shared logo and client-side navigation.
- `src/components/layout/AppLayout`: shared screen canvas, header, route outlet,
  and the existing “How it works” dialog. It reuses the original Home canvas CSS.
- `src/components/home/HomeScreen`: the responsive Figma Home screen.
- `src/pages/HomePage`: connects the Home action callbacks to Create and Join.
- `src/pages/PlaceholderPages`: minimal destinations for unfinished screens,
  using the existing TextAction component and typography/spacing tokens.
- `src/routes/paths.ts`: central route patterns with required dynamic IDs.
- `src/routes/routes.tsx`: screen definitions under the shared layout.
- `src/main.tsx` / `src/App.tsx`: React Router 7 BrowserRouter and route rendering.

## Navigation

No frontend router existed previously. React Router 7.18.4 is compatible with
the project's React 19 and Node 24 environment (it requires React 18+ and Node 20+).
Home remains visually unchanged. Its Create/Join availability notices have been
replaced by navigation; “How it works” retains its content and native dialog
behavior. The wordmark and Home link navigate to `/`, and Enter lobby code
navigates to `/lobbies/join`. Home is marked current only on the Home route.

The linked Figma file contains nine consumer screen frames and the tenth
Partner Analytics screen on the separate Partner page.

| Screen | Route | Figma node |
| --- | --- | --- |
| Home | `/` | `33:2` |
| Create Lobby | `/lobbies/create` | `33:15` |
| Join Lobby | `/lobbies/join` | `33:28` |
| Lobby | `/lobbies/:lobbyId` | `33:41` |
| Discovery Preview | `/lobbies/:lobbyId/discovery` | `33:54` |
| Voting | `/lobbies/:lobbyId/voting` | `33:67` |
| Restaurant Details | `/lobbies/:lobbyId/restaurants/:restaurantId` | `33:80` |
| Group Chat | `/lobbies/:lobbyId/chat` | `33:93` |
| Results and Final Choice | `/lobbies/:lobbyId/results` | `33:106` |
| Partner Restaurant / Analytics | `/partners/:restaurantId` | `33:119` |

Unknown URLs show a Page not found screen with a Home link. Consumer screens
use local demonstrations; Partner Analytics uses separate synthetic fixtures. Lobby links
use the current URL's `lobbyId`; Restaurant Details retains both lobby
and restaurant context. Use `useParams` to access IDs and `generatePath` with
the patterns in `paths.ts` when adding future navigation. IDs must come from
real application data; Create/Join do not generate IDs, create sessions, or
pretend a backend operation succeeded. No API calls or server authorization exist
yet; the partner preview guard only controls demonstration navigation.
`create` and `join` are reserved lobby URL segments.

The production frontend host must serve `index.html` for application URLs so
direct links and refreshes work with BrowserRouter. Vite's development and
preview servers already provide this fallback. Hosting changes are outside
this frontend-only task.

The desktop layout follows the 1440 × 1024 Figma mockup. At smaller widths the
header stacks, text scales down, buttons wrap or stack, and the food collage
stays proportional with deliberate cropping. Controls have at least 44px
interaction targets. Keyboard users get a skip link, visible focus, native
modal focus trapping, Escape dismissal, and focus restoration.

## Assets and font

The wordmark and food collage are original downloads from the
[Fork Off Figma file](https://www.figma.com/design/NGidWJoB9QBFCdTd7U4BlQ/FORKOFF-?node-id=33-2),
stored in `src/assets/figma`. Their source nodes and dimensions are documented
in that directory. No temporary Figma asset URL is used at runtime.

Atkinson Hyperlegible Regular (400) and Bold (700) are self-hosted in
`src/assets/fonts`, downloaded from the
[Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible).
Its SIL Open Font License is retained as `src/assets/fonts/OFL.txt`.

Existing lobby component placeholders, backend files, assets, fonts, tokens,
and Vite/TypeScript configuration are preserved. Only the frontend manifest
and lockfile gain the routing dependency.
