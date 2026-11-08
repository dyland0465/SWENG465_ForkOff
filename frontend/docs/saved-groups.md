# Saved Groups experience

Implemented against the clean `Dan_Branch` checkout at `bf68f03c173fb3e9259295b1744ead8707b05de8` on November 7, 2026. Current source and backend contracts were inspected before editing. No backend schema, authentication, voting, deployment, dependency manifest, or lockfile changes are required.

## User experience

- Public **Groups** navigation opens `/groups` without a login redirect. Guests see three concrete benefits, Create an Account and Log In links, and ordinary guest lobby creation/joining links.
- Signed-in users see their actual groups, stored names, saved-member counts, Start a Lobby, and View Group. Counts exclude the owner and say “plus you.” Empty groups are supported without inventing members.
- Invitations have independent loading, retry, error, empty, and count states. A group-list failure does not hide invitations. Refresh retrieves the current inbox; joining uses the existing lobby join endpoint, and declining changes the UI only after confirmation.
- `/groups/:groupId` looks up the requested group in the authenticated owner's group list. Missing, deleted, unowned, and invalid IDs show an unavailable state. The page shows all saved display names, explains reuse, and provides a primary lobby action.
- Deletion uses the existing native Dialog: Cancel gets initial focus, background controls are inert, Escape cancels, and focus returns to the trigger. Deletion explains removal of associated invitations and waits for the server. An in-progress deletion disables actions and prevents Escape dismissal. Confirmation state is isolated by account and group ID.
- `/saved` retains Favorites, Collections, restaurant search, collection sharing/import links, and collection-based lobby creation. It links to Groups instead of maintaining another group manager.

## Saving and reusing a crew

In a lobby, only a signed-in host sees **Save your crew**. Its editable name defaults to the lobby name. A synchronous submission guard and pending button prevent accidental double submission. After success, the returned group is shown with its stored-member count, excluded-guest count, and a details link. The save form is replaced by confirmation for that mounted lobby view.

The waiting-lobby section can invite an existing group and retry a failed invitation request. A missing retry target is shown as unavailable; it never silently selects another crew. Existing invitation records and responses are retained; declined invitations are not reopened.

Start a Lobby opens `/lobbies/create?group=<groupId>`. The normal location, date/time, distance, cuisine, price, rating, and dining filters remain available. The owner-scoped group is loaded and named before submission. Unavailable groups have Retry and Continue without a saved group actions. An empty group explains that no invitations will be sent. Guests can still create a normal lobby even when following a group URL.

After lobby creation, the invitation request uses the newly returned lobby ID. The lobby shows confirmed creation/invitation feedback, or a partial-success message and retry controls when invitations fail. Retrying invitations never creates another lobby. An invitation request is never presented as joined membership.

## Guest reminders and authentication

All reminders are guest-only and hidden while auth is loading. One dismissal suppresses all placements for the current tab's browsing session using `sessionStorage`; no account/group records or auth tokens are stored there.

| Placement | Copy |
| --- | --- |
| Home, beneath primary lobby actions | **Same crew every weekend?** Save your dinner group once and invite everyone faster next time. |
| Create Lobby, secondary summary area | **Make next time easier.** Want to use the same crew next time? Create an account to save your group. |
| Waiting Lobby, near crew controls when multiple members are present | **Make the next round easier.** With an account, hosts can save their signed-in crew and invite them back. |
| Completed Results, after results/actions | **Same crew next time?** Save your group with a free account and invite them back for another round. |

Each links to **Explore Saved Groups**, rather than initiating authentication within an active lobby. Lobby/results tips also say: “Finish this session before signing in; your guest membership won’t transfer.” The public Groups page explains that guest host permissions do not transfer either. Signing in replaces the guest session in the current backend; there is no automatic identity/membership migration.

Groups account links reuse `/login` with router state `{mode: 'register' | 'login', from: '/groups'}`. The existing login and registration handlers return to Groups after a confirmed account response. Existing admin/partner destination selection is preserved. Login copy now correctly says creating and joining ordinary lobbies require no account.

## Existing API contracts

All requests reuse `savedRequest`/`lobbyRequest` and the existing session cookie.

| Method and endpoint | Use |
| --- | --- |
| `GET /api/saved/groups` | Owner's overview, details lookup, create-lobby selection, and invite selector. |
| `POST /api/saved/groups` | `{name, lobbyId}`; authenticated host saves other signed-in lobby members. Response: `{group, excludedGuests}`. |
| `DELETE /api/saved/groups/:id` | Owner-scoped deletion; also deletes associated invitations. |
| `POST /api/saved/groups/:id/invitations` | `{lobbyId}`; owner and waiting-lobby host required. Response: `{invited}`. |
| `GET /api/saved/invitations` | Current recipient's pending, unexpired invitations to waiting lobbies. |
| `DELETE /api/saved/invitations/:id` | Confirmed decline. |
| `POST /api/lobbies` | Existing normal lobby creation, followed by group invitation request. |
| `POST /api/lobbies/:id/join` | Join invited lobby with the current authenticated identity; navigation follows successful join. |

The invitation `invited` count represents eligible saved nonmembers, not new deliveries or joined people. Upsert prevents duplicate invitation records but does not reset earlier accepted/declined responses. Retry copy reflects this limitation. Lobby joining updates pending invitations through the existing backend; no new acceptance endpoint is invented.

Groups are snapshots, capped by the backend at 100 other members. Only the owner can manage their saved copy. Rename, editing/removing members, ownership transfer, activity/history, guest membership migration, and reopening declined invitations remain unsupported. Server-side idempotency for ambiguous group-save network retries would require future backend support; the UI guards ordinary repeated submissions.

## Design and local preview

Referenced the existing Figma file `NGidWJoB9QBFCdTd7U4BlQ`, `01 Foundations` and `02 Components`, including typography and primary/secondary buttons. New UI uses the repository's Atkinson Hyperlegible font, orange/navy/warm palette, semantic spacing/focus/radius tokens, Button, TextAction, FormField, and native Dialog. Home artwork/crop CSS is unchanged.

From `frontend`, run `npm.cmd run dev -- --host 127.0.0.1 --port 5186 --strictPort`. Open `http://127.0.0.1:5186/groups`. Real account/group operations also need the existing backend on port 3000 and its configured MongoDB/session environment.

Preview guest Home, Groups and account mode/return navigation; signed-in Groups with empty and populated data; a valid and unavailable detail route; deletion cancel/error/success; selected-group lobby creation; host saving with guest members excluded; and invitations join/decline/retry. Check completed Results as a guest and dismissal across routes.

## Verification

Run commands from `frontend` unless a different directory is specified. Browser fixtures test the real rendered React app with intercepted HTTP responses; they are not proof of live MongoDB, session-cookie, Google Places, Socket.IO, or multi-user production integration.

- `npm.cmd run build`: passed TypeScript and Vite production build. Vite reports a bundle-size advisory for the existing single-bundle architecture.
- `npm.cmd run lint`: passed with three pre-existing `react(set-state-in-effect)` warnings in `LobbyRestaurantPreview.tsx`, `RestaurantSearch.tsx`, and `useRound.ts`; no new warnings.
- `node --test tests/*.test.mjs`: **26 passed, 0 failed**.
- From `backend`: `node --import tsx --test tests/saved-items.test.ts tests/collection-lobby.test.ts tests/authorization-matrix.test.ts tests/jwt-session.test.ts tests/jwt-login.test.ts`: **6 passed, 0 failed**. Tests use existing model stubs, not a live database. Missing installed dependencies were restored with `npm.cmd ci --ignore-scripts --no-audit --no-fund`; manifests/lockfiles were preserved.
- `node tests/groups.browser.mjs`: **107 checks passed, exit 0**. Uses installed Chrome; default URL is port 5186. Covers guest navigation/account return, guest and account create/join, owner data, details and deletion, invitation failures and confirmed actions, host saving/excluded guests, group reuse/partial failure/retry, settings/chat/discovery/voting/results contracts, favorites/collection/share regression, five viewport widths, keyboard behavior, large groups/long names, and 200% text zoom. No unexpected API requests or browser runtime exceptions occurred.
- `git diff --check`: passed.

Desktop/mobile screenshots were inspected for guest Groups, the authenticated overview/details, Home (including 1024/1920px artwork cropping), selected-group creation, host saving controls, and completed guest Results. Narrow layout checks exclude two existing unrelated elements: the lobby's absolute restaurant-thumbnail tooltip and the Results ranking heading, whose long word can overflow its own box at 320px/200% text. These are not claims of complete whole-app accessibility certification; all new group and reminder controls remain covered.

Existing browser scripts were also attempted with `FORKOFF_TEST_URL=http://127.0.0.1:5186` and do not pass against the current pre-existing live architecture:

| Script | Observed result and limitation |
| --- | --- |
| `tests/navigation.browser.mjs` | Fails at line 104: no filter-editor trigger for its invented `navigation-<width>` lobby without backend fixtures. |
| `tests/lobby.browser.mjs` | Stops at CDP setup with an unsettled top-level await. It also relies on an invented lobby and removed `.lobby-demo-note` selector. |
| `tests/results.browser.mjs` | Fails at line 88 expecting three hardcoded local demo results; current Results uses a server-managed round. |
| `tests/restaurantPreferences.browser.mjs` | Stops at CDP setup with an unsettled top-level await. It also expects removed demo/local preference controls without backend fixtures. |
| `tests/restaurantDetails.browser.mjs` | Passes 15 independent design/action checks, then fails at line 108 expecting local demo voting progress after returning to the current live voting route. |
| `tests/partnerAnalytics.browser.mjs` | Passes 13 access/form checks, then fails at line 146 expecting the former public “For Restaurants” navigation link. Current Partner navigation is role-scoped. |

These obsolete assumptions were verified against the untouched baseline source; unrelated tests/product behavior were not rewritten to restore demo architecture. Live multi-user persistence and realtime integration remain to be exercised in a configured backend environment.

## File inventory

New:

- `frontend/src/pages/GroupsPage.tsx`
- `frontend/src/pages/GroupDetailsPage.tsx`
- `frontend/src/features/saved/GroupsIntroduction.tsx`
- `frontend/src/features/saved/GroupInvitations.tsx`
- `frontend/src/features/saved/useSavedGroups.ts`
- `frontend/src/features/saved/groups.css`
- `frontend/src/features/saved/group-controls.css`
- `frontend/src/features/saved/GuestGroupsReminder.tsx`
- `frontend/src/features/saved/GuestGroupsReminder.css`
- `frontend/tests/groups.browser.mjs`
- `frontend/docs/saved-groups.md`

Modified:

- `frontend/src/routes/paths.ts`
- `frontend/src/routes/routes.tsx`
- `frontend/src/components/layout/AppHeader.tsx`
- `frontend/src/components/layout/AppHeader.css`
- `frontend/src/components/home/HomeScreen.tsx`
- `frontend/src/components/login/LoginScreen.tsx`
- `frontend/src/components/ui/Dialog.tsx`
- `frontend/src/features/saved/savedApi.ts`
- `frontend/src/features/saved/GroupControls.tsx`
- `frontend/src/pages/CreateLobbyPage.tsx`
- `frontend/src/pages/LobbyPage.tsx`
- `frontend/src/pages/ResultsPage.tsx`
- `frontend/src/pages/SavedPage.tsx`

No commits, pushes, merges, or deployments were performed.
