// FlareAction tells the host how to handle the response your flare produced.
//
// The host expects this enum encoded in the upper 32 bits of the i64 your
// `handle_request()` export returns; the lower 32 bits are reserved.
//
// - Respond     — return your Response.* output to the client and stop.
// - Transform   — your flare modified the request; pass it through.
// - PassThrough — your flare looked at the request but did nothing; pass it
//                 through unchanged to the origin.

export const enum FlareAction {
  Respond = 1,
  Transform = 2,
  PassThrough = 3,
}

/// Encode an action as the i64 return value for `handle_request()`.
export function encodeAction(a: FlareAction): i64 {
  return (<i64>(<i32>a)) << 32;
}
