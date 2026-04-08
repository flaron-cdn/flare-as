# secret-jwt

Issues a short-lived (5 minute) JWT for the requesting user. Reads the
username from the `X-User` header, signs an HS256 JWT using a domain secret,
and returns the compact JWT body. The signing secret never enters guest
memory; `Crypto.signJWT` references it by name and the host resolves the
actual key material from the secrets store.

## What it demonstrates

- `Secret.get(name)` to verify a secret is provisioned (without using the value)
- `Crypto.signJWT` with HS256 and per-request claims (sub, iss, iat, exp)
- `Time.nowUnix()` for issued-at and expiry claims
- Returning early on missing headers with appropriate HTTP status codes

## Required configuration

The flare config must allowlist the secret:

```json
{
  "allowed_secrets": ["jwt-signing-key"]
}
```

The secret itself must be provisioned via the admin UI under the domain's
secrets section.

## Build

```bash
npm run example:secret-jwt
```

## Test

```bash
curl -H "X-User: alice" https://your-domain.com/jwt
```
