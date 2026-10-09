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
- `src/components/layout/AppHeader`: shared logo and navigation.
- `src/components/home/HomeScreen`: the responsive Figma Home screen.
- `src/App.tsx`: Home action handlers. “How it works” explains the intended flow;
  create/join actions show availability notices. Lobby screens and API wiring
  are reserved for the next implementation stage. `HomeScreen` accepts callback
  props so those actions can be connected without changing its layout.

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

Existing lobby component placeholders, backend files, package manifests,
lockfiles, and Vite/TypeScript configuration are preserved.
