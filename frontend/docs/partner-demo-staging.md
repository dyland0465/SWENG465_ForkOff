# Partner Demo Preview on Coolify staging

The dashboard and CSV use only `demoPartnerAnalytics.ts` synthetic fixtures.
Partner Sign-In still reports that authentication is unavailable. Demo entry
does not authenticate a partner, call private analytics APIs, or grant access to
real restaurant information.

## Build-time settings

Set these on the **staging application** in Coolify's Environment Variables page:

| Variable | Staging value | Build time | Runtime | Real production value |
| --- | --- | --- | --- | --- |
| `VITE_APP_ENV` | `staging` | Available during build | Not required | `production` (Docker default) |
| `VITE_ENABLE_PARTNER_DEMO` | `true` | Available during build | Not required | `false` (Docker default) |

Values are exact and case-sensitive. Both settings are required for an optimized
build. Missing/other environment values disable demo access, even if the flag is
`true`; staging without the exact `true` flag also disables it. Local Vite
development still supports `VITE_ENABLE_PARTNER_DEMO=true` on its own.

Use the normal `npm run build`. Keep `NODE_ENV=production`; do not deploy a Vite
development server or set `NODE_ENV=development` to enable the demo. `VITE_APP_ENV`
is this application's deployment setting, independent of Vite's build mode.
No `--mode staging` option is needed, and that option alone does not enable it.
Vite still produces production-optimized assets. These values are compiled into
the browser bundle; changing only runtime variables or restarting an existing
container cannot change them. Rebuild and redeploy after every flag change.
See [Vite environment variables](https://vite.dev/guide/env-and-mode) and
[Coolify variable scopes](https://coolify.io/docs/applications/configuration/environment-variables).

## Deployment configuration

1. Use a separate Coolify application and HTTPS staging domain. Keep the real
   production application's values `production` / `false`; do not promote the
   staging image to production. Build a separate production image.
2. Select the **Dockerfile** build pack/strategy, repository root `/` as Base
   Directory, and `/Dockerfile` as Dockerfile Location. Build the final stage
   (leave the target unset). Under **Advanced > Build**, select **Build arguments:
   Managed manually in Dockerfile** when available. The repository Dockerfile
   declares both `ARG`s in the `frontend-build` stage, exposes them to Vite, and
   defaults to demo-disabled production. See [Coolify Dockerfile builds](https://coolify.io/docs/applications/builds/dockerfile).
3. Add the two variables above to the staging resource, enable their build-time
   scope, and save. If using Coolify preview deployments, set the same values in
   the separate **preview** variable section for that deployment. A Coolify
   environment named "staging" does not set `VITE_APP_ENV` automatically.
4. Use internal **Ports Exposes: `3000`**, runtime `PORT=3000` and
   `NODE_ENV=production` (already set by the Dockerfile). Leave public host port
   mappings empty. Keep the existing runtime backend configuration, including a
   separate staging `MONGODB_URI`, configured as runtime secrets. Never put
   credentials or private partner data in any `VITE_*` variable or build argument.
   The backend already serves the built frontend with SPA fallbacks for
   `/partners` and `/partners/harbor`; no additional Vite server is needed.
5. Configure the mandatory proxy protection below **before making staging
   reachable**, then rebuild and deploy the image. A restart alone is insufficient.
   If a deployment still has stale settings, rebuild without the build cache and
   verify the deployed revision and the variables' build-time scope.

## Mandatory server-side staging protection

The public frontend flags and editable sessionStorage marker control demo UI
only. They cannot secure a deployment. **Staging must have server-side access
protection for the entire host**, including HTML, assets, APIs, and WebSockets.

For a standard Coolify Dockerfile application, open **General > Security >
Authentication**, select **HTTP Basic Authentication**, enter a dedicated staging
username and strong password, and save. Keep **Label management: Managed by
Coolify (auto-generated)** and enable **Force HTTPS**. Redeploy so the proxy
applies the authentication middleware. Store the credentials in the deployment
settings/password manager, never in Git, frontend variables, or Partner Sign-In.
See Coolify's [Traefik Basic Authentication](https://coolify.io/docs/core/networking/proxy/traefik/basic-auth)
or [Caddy Basic Authentication](https://coolify.io/docs/core/networking/proxy/caddy/basic-auth).

If the installed Coolify version lacks that control, configure equivalent
server-side authentication at the reverse proxy (or an authenticated access
gateway/VPN) before exposing staging. Protect every configured staging domain;
remove unprotected alternate/generated domains and public container port
mappings, and block direct origin access that could bypass the protected proxy.
Basic Auth protects the staging deployment; it is separate from future partner
account authentication and per-restaurant server authorization.

Before sharing the staging URL, verify from outside the server:

- Unauthenticated `GET https://<staging-host>/partners`, `/partners/harbor`, an
  actual `/assets/...js` URL from the built page, and `/api/users/me` receive
  `401` from Basic Auth (or the access gateway's denial), never application data.
- Plain HTTP redirects to HTTPS without serving the application. All alternate
  hosts and direct origin ports are also protected or unreachable.
- A private browser window prompts for staging credentials before loading the
  app. After proxy authentication, a fresh tab opening `/partners/harbor`
  redirects to `/partners`. Choose **Preview Demo Dashboard** there to enter.
- Refresh preserves demo mode only for that tab. **Exit demo preview** returns
  to `/partners`; Back/Forward or direct dashboard navigation cannot restore it.
- Partner Sign-In still cannot sign anyone in, and all dashboard/CSV values are
  labeled synthetic. The production deployment has no demo action and ignores
  even a manually seeded preview marker.

The existing frontend route guard and entry/exit behavior are preserved. The
marker stores only `active`, represents no identity or authorization, and is
ignored when demo access is disabled. No private partner dashboard or private
analytics integration is introduced. Infrastructure protection must be configured
and verified on the deployed host; local frontend tests cannot prove it.
