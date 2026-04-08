// ID — host-provided unique identifier generators. Each generator is gated
// by an invocation count limit so calling them in a loop will eventually get
// you empty strings.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen, readPackedString } from "./io";
import { JsonObject } from "./json";

export const enum UuidVersion {
  V4 = 0,
  V7 = 1,
}

function uuidVersionName(v: UuidVersion): string {
  if (v == UuidVersion.V7) return "v7";
  return "v4";
}

export class ID {
  /// Generate a UUID. v4 is random, v7 is time-ordered.
  static uuid(version: UuidVersion = UuidVersion.V4): string {
    const args = new JsonObject().setString("version", uuidVersionName(version)).toString();
    const buf = strToUtf8(args);
    const packed = env.id_uuid(bytesPtr(buf), bytesLen(buf));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }

  /// Generate a ULID — sortable, 26-character base32 ID.
  static ulid(): string {
    const s = readPackedString(env.id_ulid());
    return s == null ? "" : s!;
  }

  /// Generate a Nano ID with the given length. Length 0 uses the host default
  /// (typically 21).
  static nanoid(length: i32 = 0): string {
    const s = readPackedString(env.id_nanoid(length));
    return s == null ? "" : s!;
  }

  /// Generate a KSUID — sortable, 27-character ID with embedded timestamp.
  static ksuid(): string {
    const s = readPackedString(env.id_ksuid());
    return s == null ? "" : s!;
  }

  /// Generate a snowflake ID via the edge-ops generator (different from
  /// `Snowflake.next()` which uses the dedicated `snowflake_id` host fn).
  static snowflake(): string {
    const s = readPackedString(env.id_snowflake());
    return s == null ? "" : s!;
  }
}
