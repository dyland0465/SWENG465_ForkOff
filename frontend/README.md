# Fork Off! frontend

React + TypeScript + Vite, with plain CSS and the Fork Off Figma design system.

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
backend dependencies. Partner Restaurant remains a placeholder.

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

The build includes TypeScript checking. No automated test suite is configured.

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

The linked Figma file contains nine consumer screen frames. The tenth destination
is the Partner Restaurant screen, confirmed separately and awaiting its design.

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
| Partner Restaurant | `/partners/:restaurantId` | Design pending |

Unknown URLs show a Page not found screen with a Home link. Consumer screens
use local demonstrations; Partner Restaurant remains a placeholder. Lobby links
use the current URL's `lobbyId`; Restaurant Details retains both lobby
and restaurant context. Use `useParams` to access IDs and `generatePath` with
the patterns in `paths.ts` when adding future navigation. IDs must come from
real application data; Create/Join do not generate IDs, create sessions, or
pretend a backend operation succeeded. No API calls or access checks exist yet.
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
