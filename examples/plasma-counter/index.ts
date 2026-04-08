// Cross-edge view counter using Plasma. Plasma is a CRDT-backed KV store
// replicated to every other edge node, so increments converge globally.
// Hit any edge and the global count goes up by one.
//
// Demonstrates: Plasma.increment for atomic global counters.

import { alloc, resetArena, Response, Plasma } from "../../assembly/index";

export { alloc };

const GLOBAL_KEY = "views:global";

export function handle_request(): i64 {
  resetArena();

  const total = Plasma.increment(GLOBAL_KEY, 1);

  Response.setStatus(200);
  Response.setHeader("content-type", "application/json");
  Response.setBodyString("{\"global_views\":" + total.toString() + "}");
  return Response.respond();
}
