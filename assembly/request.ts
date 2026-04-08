// Request reads the inbound HTTP request data the flaron host has staged for
// this invocation. All accessors are static — there's only one inbound
// request per invocation, so an instance would buy nothing.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen, readPackedString, readPackedBytes } from "./io";

export class Request {
  /// HTTP method (GET, POST, …). Always uppercase.
  static method(): string {
    const s = readPackedString(env.req_method());
    return s == null ? "" : s!;
  }

  /// Full request URL including path and query string.
  static url(): string {
    const s = readPackedString(env.req_url());
    return s == null ? "" : s!;
  }

  /// Look up a request header by name. Returns the value or null if absent.
  /// Header names are case-insensitive on the host side.
  static header(name: string): string | null {
    const nameBuf = strToUtf8(name);
    const packed = env.req_header_get(bytesPtr(nameBuf), bytesLen(nameBuf));
    return readPackedString(packed);
  }

  /// Inbound request body as raw bytes. Returns an empty array when there is
  /// no body or the flare config did not request body access.
  static body(): Uint8Array {
    const bytes = readPackedBytes(env.req_body());
    return bytes == null ? new Uint8Array(0) : bytes!;
  }

  /// Convenience: inbound body decoded as a UTF-8 string.
  static bodyString(): string {
    const b = Request.body();
    if (b.length == 0) return "";
    return String.UTF8.decodeUnsafe(b.dataStart, b.byteLength, false);
  }
}
