# @flaron-cdn/flare-as

AssemblyScript SDK for building [Flaron](https://flaron.dev) flares: small,
fast, type-safe WebAssembly modules that run on the Flaron edge runtime.

AssemblyScript compiles a strict subset of TypeScript directly to WebAssembly,
producing tiny binaries (typically 3-10 KB per flare) without dragging in a
runtime, garbage collector, or JavaScript engine. Your flares start in
microseconds and execute at native speed.

## Why AssemblyScript?

- **Familiar syntax**: looks like TypeScript, behaves like Wasm
- **Tiny output**: examples in this repo compile to 2.6-7.2 KB
- **Strict types**: `i32`, `i64`, `f32`, `f64`, `string`, `Uint8Array`
- **No closures**: class methods replace callbacks (host limitation)
- **Single-pass compile**: no `tsc` step, no bundler, no `node_modules` at runtime

## Installation

```bash
npm install @flaron-cdn/flare-as
```

You'll also need AssemblyScript itself in your project:

```bash
npm install --save-dev assemblyscript
```

## Quick start: HTTP echo flare

Create `assembly/index.ts`:

```ts
import { alloc, resetArena, Request, Response } from "@flaron-cdn/flare-as";

// alloc must be re-exported so the host can write data into your linear memory.
export { alloc };

export function handle_request(): i64 {
  resetArena();

  const method = Request.method();
  const url = Request.url();

  Response.setStatus(200);
  Response.setHeader("content-type", "text/plain");
  Response.setBodyString(method + " " + url + "\n");

  return Response.respond();
}
```

Create `asconfig.json`:

```json
{
  "targets": {
    "release": {
      "outFile": "build/flare.wasm",
      "optimizeLevel": 3,
      "shrinkLevel": 1,
      "runtime": "stub",
      "exportRuntime": true
    }
  }
}
```

Build:

```bash
npx asc assembly/index.ts --target release
```

That's it. `build/flare.wasm` is your deployable artefact.

## API surface

| Class | What it does |
|---|---|
| [`Request`](assembly/request.ts) | Read inbound HTTP method, URL, headers, body |
| [`Response`](assembly/response.ts) | Write outbound status, headers, body, and return action |
| [`Spark`](assembly/spark.ts) | Per-edge KV store with TTL (NOT replicated) |
| [`Plasma`](assembly/plasma.ts) | Cross-edge replicated KV with PN-counter semantics |
| [`Secret`](assembly/secret.ts) | Read per-domain secrets (allowlist gated) |
| [`Snowflake`](assembly/snowflake.ts) | Generate sortable distributed IDs |
| [`Beam`](assembly/beam.ts) | Outbound HTTP fetches with FetchOptions |
| [`WS`](assembly/ws.ts) | WebSocket open/message/close handlers and send |
| [`Log`](assembly/log.ts) | Structured logging into the host slog stream |
| [`Crypto`](assembly/crypto.ts) | Hash, HMAC, JWT signing, AES, random bytes |
| [`Encoding`](assembly/encoding.ts) | base64, hex, URL encode/decode |
| [`ID`](assembly/id.ts) | UUID v4/v7, ULID, NanoID, KSUID, snowflake |
| [`Time`](assembly/time.ts) | Wall-clock timestamps in 6 formats |

Every class uses `static` methods, since there is no instance state when
only one inbound request exists per invocation.

## Required exports

Every flare must export at minimum:

- `alloc(size: i32) -> i32`: re-exported from this SDK; the host calls it to
  write request data and host-function results into your linear memory
- `handle_request() -> i64` (HTTP) **or** `ws_open()` / `ws_message()` /
  `ws_close()` (WebSocket)

The return value of `handle_request` is an action enum encoded in the upper
32 bits of an i64:

- `Response.respond()`: emit your `Response.set*` writes back to the client
- `Response.transform()`: pass the (modified) request through to the origin
- `Response.passThrough()`: pass the request through unchanged

## Memory model

The flaron host calls your exported `alloc(size)` whenever it needs to write
a value into your linear memory (every header read, every `Spark.get()`,
every WebSocket event). To prevent unbounded memory growth across requests,
this SDK uses a **256 KiB static bump arena** that you reset at the top of
every export with `resetArena()`. Forgetting to call `resetArena()` will
exhaust the arena after a few hundred requests and crash the flare.

```ts
export function handle_request(): i64 {
  resetArena();  // ALWAYS call this first
  // …
}
```

## Examples

Seven worked examples live in [`examples/`](examples/):

| Example | What it shows |
|---|---|
| [`hello`](examples/hello) | Minimal HTTP responder |
| [`spark-counter`](examples/spark-counter) | Per-edge KV with TTL |
| [`plasma-counter`](examples/plasma-counter) | Cross-edge atomic counter |
| [`secret-jwt`](examples/secret-jwt) | Domain secrets and JWT signing |
| [`websocket-echo`](examples/websocket-echo) | WebSocket event handlers |
| [`beam-fetch`](examples/beam-fetch) | Outbound HTTP with FetchOptions |
| [`edge-ops`](examples/edge-ops) | All edge ops in one flare |

Build them all:

```bash
npm run examples
```

Or build one:

```bash
npm run example:hello
```

## Testing

The SDK has a self-contained test suite that compiles a guest wasm module,
loads it with mock flaron/v1 host imports, and asserts on every public
method:

```bash
npm test
```

50 tests cover every class and host-function binding. Add new tests by
extending `tests/guest/test.ts` and `tests/runner.mjs` together.

## Building

```bash
npm run asbuild         # debug + release
npm run asbuild:debug   # build/debug.wasm with source maps
npm run asbuild:release # build/release.wasm optimized
```

The release build uses `optimizeLevel: 3, shrinkLevel: 1` for the smallest
output. The SDK itself contributes ~2 KB; your code is most of the rest.

## AssemblyScript notes

- AS does NOT support closures. Use class static methods or pass typed
  arrays / structured args.
- AS does NOT support `any`. Explicit type annotations everywhere.
- AS strings are UTF-16 internally; the SDK transcodes to UTF-8 at every
  host boundary so this is invisible to you.
- AS does NOT have `async`/`await`. Host functions are synchronous from
  the guest's perspective, and the host runtime handles concurrency.

## Documentation

Full documentation lives at [flaron.dev](https://flaron.dev).

## License

MIT. See [LICENSE](LICENSE).
