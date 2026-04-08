// Minimal JSON builder and reader for the host envelope format.
//
// The flaron edge ops API expects small JSON objects like
//   {"algorithm":"sha256","input":"data"}
// for argument passing, and returns small JSON values from beam_fetch and the
// list operations. AS doesn't ship a JSON library so we provide a hand-rolled
// builder for objects with string and integer fields and a tolerant reader
// for the shapes the SDK actually consumes — strings, integers, and string
// arrays. We do not aim for full JSON parser correctness; the host emits a
// well-defined subset and that's what we accept.

/// JsonObject builds a flat JSON object incrementally. Use it for the
/// envelope arguments expected by edge ops host functions.
export class JsonObject {
  private parts: string[] = [];

  setString(key: string, value: string): JsonObject {
    this.parts.push('"' + escape(key) + '":"' + escape(value) + '"');
    return this;
  }

  setInt(key: string, value: i64): JsonObject {
    this.parts.push('"' + escape(key) + '":' + value.toString());
    return this;
  }

  setRawObject(key: string, jsonLiteral: string): JsonObject {
    this.parts.push('"' + escape(key) + '":' + jsonLiteral);
    return this;
  }

  toString(): string {
    return "{" + this.parts.join(",") + "}";
  }
}

/// Build a JSON object literal `{"k":"v","k2":"v2"}` from a flat string map.
/// Used by Beam.fetch when serialising header maps for the options envelope.
export function buildStringMap(keys: string[], values: string[]): string {
  if (keys.length != values.length) return "{}";
  const parts = new Array<string>(keys.length);
  for (let i = 0; i < keys.length; i++) {
    parts[i] = '"' + escape(keys[i]) + '":"' + escape(values[i]) + '"';
  }
  return "{" + parts.join(",") + "}";
}

/// Parse a JSON array of strings (e.g. spark_list/plasma_list output). Skips
/// whitespace and accepts plain `["a","b"]`. Returns an empty array on any
/// parse error — list operations only fail if the host is broken, in which
/// case empty is the correct conservative answer.
export function parseStringArray(json: string): string[] {
  const out: string[] = [];
  const len = json.length;
  let i = skipWS(json, 0);
  if (i >= len || json.charCodeAt(i) != 0x5b /* [ */) return out;
  i++;
  i = skipWS(json, i);
  if (i < len && json.charCodeAt(i) == 0x5d /* ] */) return out;
  while (i < len) {
    i = skipWS(json, i);
    if (i >= len || json.charCodeAt(i) != 0x22 /* " */) return out;
    i++;
    const start = i;
    while (i < len && json.charCodeAt(i) != 0x22) {
      // Skip escaped quotes; we accept the simple cases the host produces.
      if (json.charCodeAt(i) == 0x5c /* \ */ && i + 1 < len) i += 2;
      else i++;
    }
    if (i >= len) return out;
    out.push(unescape(json.substring(start, i)));
    i++;
    i = skipWS(json, i);
    if (i >= len) return out;
    const c = json.charCodeAt(i);
    if (c == 0x5d) return out;
    if (c != 0x2c /* , */) return out;
    i++;
  }
  return out;
}

/// FetchResponse mirrors the JSON shape returned by beam_fetch:
///   {"status":200, "headers":{...}, "body":"..."}
/// We expose only the fields the SDK consumer needs and ignore everything
/// else. Headers is parsed lazily via getHeader to avoid building a full map
/// when the caller only inspects one or two values.
export class FetchResponse {
  status: i32 = 0;
  body: string = "";
  private headersJson: string = "{}";

  getHeader(name: string): string {
    return readObjectStringField(this.headersJson, name);
  }

  static fromJson(json: string): FetchResponse {
    const r = new FetchResponse();
    r.status = <i32>readObjectIntField(json, "status");
    r.body = readObjectStringField(json, "body");
    r.headersJson = readObjectRawField(json, "headers", "{}");
    return r;
  }
}

function escape(s: string): string {
  let out = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c == 0x22) out += "\\\"";
    else if (c == 0x5c) out += "\\\\";
    else if (c == 0x0a) out += "\\n";
    else if (c == 0x0d) out += "\\r";
    else if (c == 0x09) out += "\\t";
    else if (c < 0x20) {
      let hex = (c as u32).toString(16);
      while (hex.length < 4) hex = "0" + hex;
      out += "\\u" + hex;
    } else {
      out += String.fromCharCode(c);
    }
  }
  return out;
}

function unescape(s: string): string {
  if (s.indexOf("\\") < 0) return s;
  let out = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c == 0x5c && i + 1 < len) {
      const next = s.charCodeAt(i + 1);
      if (next == 0x22) { out += "\""; i++; }
      else if (next == 0x5c) { out += "\\"; i++; }
      else if (next == 0x6e) { out += "\n"; i++; }
      else if (next == 0x72) { out += "\r"; i++; }
      else if (next == 0x74) { out += "\t"; i++; }
      else if (next == 0x2f) { out += "/"; i++; }
      else { out += String.fromCharCode(c); }
    } else {
      out += String.fromCharCode(c);
    }
  }
  return out;
}

function skipWS(json: string, start: i32): i32 {
  let i = start;
  while (i < json.length) {
    const c = json.charCodeAt(i);
    if (c == 0x20 || c == 0x09 || c == 0x0a || c == 0x0d) i++;
    else break;
  }
  return i;
}

/// Find a top-level field key inside a flat JSON object. Returns the index of
/// the byte AFTER the colon (i.e. the start of the value), or -1 if missing.
function findField(json: string, key: string): i32 {
  const needle = "\"" + key + "\"";
  let from = 0;
  while (true) {
    const idx = json.indexOf(needle, from);
    if (idx < 0) return -1;
    let i = idx + needle.length;
    i = skipWS(json, i);
    if (i >= json.length) return -1;
    if (json.charCodeAt(i) != 0x3a /* : */) {
      from = idx + 1;
      continue;
    }
    return skipWS(json, i + 1);
  }
}

function readObjectStringField(json: string, key: string): string {
  const i = findField(json, key);
  if (i < 0) return "";
  if (i >= json.length || json.charCodeAt(i) != 0x22) return "";
  let j = i + 1;
  const start = j;
  while (j < json.length) {
    const c = json.charCodeAt(j);
    if (c == 0x5c && j + 1 < json.length) { j += 2; continue; }
    if (c == 0x22) break;
    j++;
  }
  return unescape(json.substring(start, j));
}

function readObjectIntField(json: string, key: string): i64 {
  const i = findField(json, key);
  if (i < 0) return 0;
  let j = i;
  let sign: i64 = 1;
  if (j < json.length && json.charCodeAt(j) == 0x2d) { sign = -1; j++; }
  let n: i64 = 0;
  let hadDigit = false;
  while (j < json.length) {
    const c = json.charCodeAt(j);
    if (c < 0x30 || c > 0x39) break;
    n = n * 10 + (c - 0x30);
    hadDigit = true;
    j++;
  }
  return hadDigit ? n * sign : 0;
}

/// Extract the raw substring representing a field's value. Used to lazily
/// hold the headers object inside a FetchResponse without parsing it eagerly.
function readObjectRawField(json: string, key: string, fallback: string): string {
  const start = findField(json, key);
  if (start < 0) return fallback;
  if (start >= json.length) return fallback;
  const c = json.charCodeAt(start);
  if (c != 0x7b /* { */ && c != 0x5b /* [ */) return fallback;
  const open = c;
  const close: i32 = open == 0x7b ? 0x7d : 0x5d;
  let depth = 0;
  let i = start;
  let inString = false;
  while (i < json.length) {
    const ch = json.charCodeAt(i);
    if (inString) {
      if (ch == 0x5c && i + 1 < json.length) { i += 2; continue; }
      if (ch == 0x22) inString = false;
    } else {
      if (ch == 0x22) inString = true;
      else if (ch == open) depth++;
      else if (ch == close) {
        depth--;
        if (depth == 0) return json.substring(start, i + 1);
      }
    }
    i++;
  }
  return fallback;
}
