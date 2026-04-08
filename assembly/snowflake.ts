// Snowflake — sortable, distributed unique 64-bit IDs encoded as decimal
// strings. The host's snowflake generator is gated by a per-invocation count
// limit so this returns the empty string when exhausted.

import * as env from "./env";
import { readPackedString } from "./io";

export class Snowflake {
  /// Generate a new snowflake ID. Returns empty string if the per-invocation
  /// limit was reached or the host snowflake generator is unconfigured.
  static next(): string {
    const s = readPackedString(env.snowflake_id());
    return s == null ? "" : s!;
  }
}
