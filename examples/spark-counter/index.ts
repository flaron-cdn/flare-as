// Per-edge view counter using Spark KV. Each edge node keeps its own count
// (Spark is NOT replicated). Increments on every request and returns the
// current count for this edge as JSON.
//
// Demonstrates: Spark.get/set with TTL, JSON response body.

import {
  alloc,
  resetArena,
  Response,
  Spark,
} from "../../assembly/index";

export { alloc };

const COUNTER_KEY = "views:total";
const COUNTER_TTL: i32 = 0; // never expire

export function handle_request(): i64 {
  resetArena();

  let current: i64 = 0;
  const entry = Spark.get(COUNTER_KEY);
  if (entry != null) {
    const s = entry!.asString();
    current = I64.parseInt(s);
  }

  current++;
  Spark.setString(COUNTER_KEY, current.toString(), COUNTER_TTL);

  Response.setStatus(200);
  Response.setHeader("content-type", "application/json");
  Response.setBodyString("{\"edge_views\":" + current.toString() + "}");
  return Response.respond();
}
