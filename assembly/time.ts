// Time — host-provided timestamps. Guest wasm cannot read the wall clock
// directly without a syscall (we don't link WASI) so all time queries flow
// through the host.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen, readPackedString } from "./io";
import { JsonObject } from "./json";

export const enum TimeFormat {
  Unix = 0,    // seconds since epoch
  Ms = 1,      // milliseconds since epoch
  Ns = 2,      // nanoseconds since epoch
  RFC3339 = 3,
  HTTP = 4,    // RFC1123 with GMT, used in HTTP headers
  ISO8601 = 5,
}

function timeFormatName(f: TimeFormat): string {
  if (f == TimeFormat.Ms) return "ms";
  if (f == TimeFormat.Ns) return "ns";
  if (f == TimeFormat.RFC3339) return "rfc3339";
  if (f == TimeFormat.HTTP) return "http";
  if (f == TimeFormat.ISO8601) return "iso8601";
  return "unix";
}

export class Time {
  /// Get the current timestamp in the requested format. String formats are
  /// returned verbatim; numeric formats are returned as decimal strings.
  static now(format: TimeFormat = TimeFormat.Unix): string {
    const args = new JsonObject().setString("format", timeFormatName(format)).toString();
    const buf = strToUtf8(args);
    const packed = env.timestamp(bytesPtr(buf), bytesLen(buf));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }

  /// Convenience: current time as unix milliseconds.
  static nowMs(): i64 {
    return I64.parseInt(Time.now(TimeFormat.Ms));
  }

  /// Convenience: current time as unix seconds.
  static nowUnix(): i64 {
    return I64.parseInt(Time.now(TimeFormat.Unix));
  }
}
