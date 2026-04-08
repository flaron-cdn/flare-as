// Beam — outbound HTTP fetches from the flare to any URL the operator
// allowed. Limited per invocation to MaxFetchRequests; the host enforces
// timeouts and TLS validation.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen, readPackedString } from "./io";
import { JsonObject, FetchResponse, buildStringMap } from "./json";

export { FetchResponse } from "./json";

/// FetchOptions configures a beam_fetch call. All fields are optional. Method
/// defaults to GET when omitted.
export class FetchOptions {
  method: string = "";
  body: string = "";
  private headerNames: string[] = [];
  private headerValues: string[] = [];

  /// Add a request header. Calling twice with the same name overwrites.
  setHeader(name: string, value: string): FetchOptions {
    for (let i = 0; i < this.headerNames.length; i++) {
      if (this.headerNames[i] == name) {
        this.headerValues[i] = value;
        return this;
      }
    }
    this.headerNames.push(name);
    this.headerValues.push(value);
    return this;
  }

  toJson(): string {
    const obj = new JsonObject();
    if (this.method.length > 0) obj.setString("method", this.method);
    if (this.body.length > 0) obj.setString("body", this.body);
    if (this.headerNames.length > 0) {
      obj.setRawObject("headers", buildStringMap(this.headerNames, this.headerValues));
    }
    return obj.toString();
  }
}

export class Beam {
  /// Make an outbound HTTP request. Returns a FetchResponse parsed from the
  /// host's JSON envelope. Returns null when the host signals a fetch error
  /// (timeout, DNS failure, fetch limit reached, …).
  static fetch(url: string, opts: FetchOptions | null = null): FetchResponse | null {
    const urlBuf = strToUtf8(url);
    const optsJson = opts == null ? "{}" : opts!.toJson();
    const optsBuf = strToUtf8(optsJson);
    const packed = env.beam_fetch(
      bytesPtr(urlBuf),
      bytesLen(urlBuf),
      bytesPtr(optsBuf),
      bytesLen(optsBuf),
    );
    const json = readPackedString(packed);
    if (json == null) return null;
    return FetchResponse.fromJson(json!);
  }
}
