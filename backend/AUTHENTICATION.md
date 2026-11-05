# Authentication setup

ForkOff uses HS256 JWTs in the HttpOnly `forkoff_session` cookie. The server verifies the signature, issuer, audience and expiry and checks the token hash against MongoDB on every authenticated request. This keeps logout, account deletion and role changes effective. WebSocket connections use the same verification.

Set `JWT_SECRET` to a unique, randomly generated secret of at least 32 bytes. For example, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in `backend/.env` as `JWT_SECRET=<generated-value>`. Keep it private and use a different value for each environment. In production, set it as a secret environment variable on the server; every replica must use the same value. Startup fails if it is missing or shorter than 32 bytes. `NODE_ENV=production` enables the Secure cookie flag; production must serve HTTPS.

Upgrading from opaque sessions invalidates existing login and guest cookies. Users must sign in or join again. Rotating `JWT_SECRET` also invalidates every existing JWT. The frontend continues to send the cookie with requests; it should not store JWTs in browser local storage.

## API access and rate limiting

Restaurant deletion is restricted to assigned approved partners and administrators. Account operations require the current account's verified JWT session. Guest lobby creation and joining, restaurant discovery, and restaurant import remain public. Admin, partner management and lobby operations check roles, ownership or membership server-side.

MongoDB stores shared per-client-IP fixed-window counters across replicas. Login permits 10 requests per 15 minutes; registration 5 per hour; lobby creation 20 per hour; lobby joining 30 per 15 minutes; messages 60 per minute; Google Places/search operations 30 per minute. A response over the limit is 429 with `Retry-After`; if the shared store is unavailable, protected operations return 503. Counters expire automatically through a MongoDB TTL index. Fixed windows may allow bursts around a window boundary; clients behind a common IP share a quota.

Express currently trusts exactly one reverse proxy (`trust proxy = 1`). Production must route all traffic through exactly that trusted proxy, which must replace client-supplied forwarding headers, and must block direct public access to the backend. If the deployment topology differs, configure the trust boundary accordingly before release. Verify HTTPS, `NODE_ENV=production`, the private `JWT_SECRET`, Google API key restrictions and budget/quotas, MongoDB index creation, and the rate limits on the actual deployment. These deployment settings cannot be verified from source alone.
