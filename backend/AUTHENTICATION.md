# Authentication setup

ForkOff uses HS256 JWTs in the HttpOnly `forkoff_session` cookie. The server verifies the signature, issuer, audience and expiry and checks the token hash against MongoDB on every authenticated request. This keeps logout, account deletion and role changes effective. WebSocket connections use the same verification.

Set `JWT_SECRET` to a unique, randomly generated secret of at least 32 bytes. For example, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in `backend/.env` as `JWT_SECRET=<generated-value>`. Keep it private and use a different value for each environment. In production, set it as a secret environment variable on the server; every replica must use the same value. Startup fails if it is missing or shorter than 32 bytes. `NODE_ENV=production` enables the Secure cookie flag; production must serve HTTPS.

Upgrading from opaque sessions invalidates existing login and guest cookies. Users must sign in or join again. Rotating `JWT_SECRET` also invalidates every existing JWT. The frontend continues to send the cookie with requests; it should not store JWTs in browser local storage.
