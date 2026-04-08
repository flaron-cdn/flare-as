# edge-ops

Showcases the full set of edge operations available on the flaron host:
hashing, encoding, multiple ID generators, snowflake, and timestamp formats.
Returns a JSON document with one field per operation so you can verify the
host runtime end-to-end.

## What it demonstrates

- `Crypto.hash(SHA256, input)` for digest computation
- `Encoding.base64Encode` and `Encoding.hexEncode` on raw bytes
- `ID.uuid(V7)`, `ID.ulid()`, `ID.nanoid()`, `ID.ksuid()` for unique IDs
- `Snowflake.next()` for distributed sortable IDs
- `Time.now(format)` with Unix, milliseconds, and RFC3339 formats
- Building a JSON response by string concatenation

## Build

```bash
npm run example:edge-ops
```

## Sample response

```json
{
  "input": "flaron edge ops showcase",
  "sha256": "…",
  "base64": "…",
  "hex": "…",
  "uuid": "01HZ…",
  "ulid": "01HZ…",
  "nanoid": "V1StGXR8…",
  "ksuid": "1nfBmPkX…",
  "snowflake": "1234567890123456789",
  "unix_sec": "1717977600",
  "unix_ms": "1717977600000",
  "rfc3339": "2026-04-07T11:20:00Z"
}
```
