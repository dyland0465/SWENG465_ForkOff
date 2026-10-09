# Fork Off! frontend

React + TypeScript + Vite, with plain CSS and the Fork Off Figma design system.

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

Unknown URLs show a Page not found screen with a Home link. All destinations
except Home are placeholders. Lobby-scoped placeholders offer a Back to lobby
link using the current URL's `lobbyId`; Restaurant Details retains both lobby
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
