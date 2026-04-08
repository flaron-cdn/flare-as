// Response builds the outbound HTTP response the flaron host will return to
// the client. All writes are streamed directly to the host — there is no
// buffered response state on the guest side.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen } from "./io";
import { FlareAction, encodeAction } from "./action";

export class Response {
  /// Set the HTTP status code (200, 404, 500, …).
  static setStatus(code: i32): void {
    env.resp_set_status(code);
  }

  /// Set a response header. Calling twice with the same name overwrites.
  static setHeader(name: string, value: string): void {
    const nameBuf = strToUtf8(name);
    const valBuf = strToUtf8(value);
    env.resp_header_set(
      bytesPtr(nameBuf),
      bytesLen(nameBuf),
      bytesPtr(valBuf),
      bytesLen(valBuf),
    );
  }

  /// Set the response body to raw bytes.
  static setBody(body: Uint8Array): void {
    env.resp_body_set(bytesPtr(body), bytesLen(body));
  }

  /// Convenience: set the response body from a string. Encoded as UTF-8.
  static setBodyString(body: string): void {
    const buf = strToUtf8(body);
    env.resp_body_set(bytesPtr(buf), bytesLen(buf));
  }

  /// Build the i64 you return from `handle_request()` to tell the host to
  /// emit your Response.* writes back to the client.
  static respond(): i64 {
    return encodeAction(FlareAction.Respond);
  }

  /// Tell the host the request was modified and should be passed through to
  /// the origin with your changes applied.
  static transform(): i64 {
    return encodeAction(FlareAction.Transform);
  }

  /// Tell the host to pass the original request through to the origin
  /// untouched.
  static passThrough(): i64 {
    return encodeAction(FlareAction.PassThrough);
  }
}
