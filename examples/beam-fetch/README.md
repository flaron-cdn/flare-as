# beam-fetch

Proxies every request to https://api.github.com/zen with a custom user-agent
header, forwards the upstream's response, and tags it with `x-proxied-by`.

## What it demonstrates

- `FetchOptions` builder pattern with method, headers, and body
- `Beam.fetch(url, opts)` returning a `FetchResponse | null`
- Reading response headers via `FetchResponse.getHeader(name)`
- Forwarding upstream status and body to the client
- Pulling a request header (`user-agent`) and re-sending it on the upstream call

## Required configuration

The flare config must allow outbound fetches and the target URL:

```json
{
  "max_fetch_requests": 5,
  "allowed_fetch_urls": ["https://api.github.com/*"]
}
```

## Build

```bash
npm run example:beam-fetch
```
