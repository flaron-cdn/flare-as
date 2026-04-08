# plasma-counter

Global view counter using Plasma CRDT KV. Unlike `spark-counter`, every edge
sees the same total because Plasma replicates writes via gossip. Increments
from different edges merge correctly even under network partitions thanks to
the PN-counter semantics.

## What it demonstrates

- `Plasma.increment(key, delta)` for atomic distributed counters
- The 8-byte little-endian i64 wire format Plasma uses for counter values
- Single-call atomicity, no read/modify/write race

## Required capabilities

The flare config must enable Plasma writes:

```json
{
  "writes_plasma_kv": true
}
```

## Build

```bash
npm run example:plasma-counter
```

Output: `examples/plasma-counter/build/plasma-counter.wasm`
