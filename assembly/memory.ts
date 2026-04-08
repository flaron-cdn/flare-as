// Bump-arena allocator for host-to-guest data exchange.
//
// The flaron host calls `alloc(size)` whenever it needs to write a value into
// guest memory (every spark_get, every header read, every WS event). A naive
// allocator would leak memory across invocations and a long-running flare
// would steadily grow.
//
// Instead we expose a fixed static arena (memory.data) and a bump pointer.
// At the top of every guest export the runtime resets the bump pointer; all
// allocations made by the host during that invocation are reclaimed when we
// return. WASM is single-threaded so a single mutable offset is sound.

const ARENA_SIZE: i32 = 256 * 1024;
const ARENA: usize = memory.data(ARENA_SIZE);

let arenaOffset: i32 = 0;

/// Reset the bump arena. Call at the top of every guest export so the next
/// host invocation starts fresh.
export function resetArena(): void {
  arenaOffset = 0;
}

/// Guest allocator called by the flaron host to write return values into our
/// linear memory. Returns 0 on failure (size invalid or arena exhausted) —
/// the host treats 0 as "guest cannot accept this value".
export function alloc(size: i32): i32 {
  if (size <= 0) return 0;
  // 8-byte align so subsequent allocations don't trip up native loads.
  const aligned: i32 = (arenaOffset + 7) & ~7;
  const end: i32 = aligned + size;
  if (end > ARENA_SIZE || end < aligned) return 0;
  arenaOffset = end;
  return <i32>(ARENA) + aligned;
}

/// Pack (ptr, len) into the i64 wire format used by the host. The host's
/// convention is high 32 bits = pointer, low 32 bits = length.
export function packPtrLen(ptr: i32, len: i32): i64 {
  return (<i64>(<u32>ptr) << 32) | <i64>(<u32>len);
}

/// Decode a packed i64 into the high 32 bits (pointer).
export function unpackPtr(packed: i64): i32 {
  return <i32>(<u32>(<u64>packed >> 32));
}

/// Decode a packed i64 into the low 32 bits (length).
export function unpackLen(packed: i64): i32 {
  return <i32>(<u32>(<u64>packed & 0xFFFFFFFF));
}
