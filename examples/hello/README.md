# hello

The simplest possible Flaron flare. Responds with `Hello from Flaron!` and the
request URL on every request.

## What it demonstrates

- Reading the request URL via `Request.url()`
- Setting status and headers via `Response.setStatus()` and `Response.setHeader()`
- Writing a string body via `Response.setBodyString()`
- Returning `Response.respond()` to tell the host to emit your response

## Build

```bash
npm run example:hello
```

Output: `examples/hello/build/hello.wasm`

## Deploy

Upload the `hello.wasm` file to your Flaron domain via the admin UI or
`flarectl deploy hello.wasm`.
