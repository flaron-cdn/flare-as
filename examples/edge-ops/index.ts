// Edge operations showcase. Generates a payload that exercises every
// edgeops host function group: hashing, encoding, ID generation, snowflake,
// and timestamps. Returns the result as a JSON document.
//
// Demonstrates: Crypto.hash, Encoding.base64Encode, ID.uuid/ulid/nanoid,
// Snowflake.next, Time.now with multiple formats.

import {
  alloc,
  resetArena,
  Response,
  Crypto,
  HashAlgorithm,
  Encoding,
  ID,
  UuidVersion,
  Snowflake,
  Time,
  TimeFormat,
} from "../../assembly/index";

export { alloc };

export function handle_request(): i64 {
  resetArena();

  const sample = "flaron edge ops showcase";
  const sampleBytes = String.UTF8.encode(sample, false);
  const sampleU8 = Uint8Array.wrap(sampleBytes);

  const sha256Hex = Crypto.hash(HashAlgorithm.SHA256, sample);
  const base64 = Encoding.base64Encode(sampleU8);
  const hexEncoded = Encoding.hexEncode(sampleU8);

  const uuid = ID.uuid(UuidVersion.V7);
  const ulid = ID.ulid();
  const nanoid = ID.nanoid(21);
  const ksuid = ID.ksuid();
  const snowflake = Snowflake.next();

  const unixSec = Time.now(TimeFormat.Unix);
  const unixMs = Time.now(TimeFormat.Ms);
  const rfc = Time.now(TimeFormat.RFC3339);

  let body = "{";
  body += "\"input\":\"" + sample + "\",";
  body += "\"sha256\":\"" + sha256Hex + "\",";
  body += "\"base64\":\"" + base64 + "\",";
  body += "\"hex\":\"" + hexEncoded + "\",";
  body += "\"uuid\":\"" + uuid + "\",";
  body += "\"ulid\":\"" + ulid + "\",";
  body += "\"nanoid\":\"" + nanoid + "\",";
  body += "\"ksuid\":\"" + ksuid + "\",";
  body += "\"snowflake\":\"" + snowflake + "\",";
  body += "\"unix_sec\":\"" + unixSec + "\",";
  body += "\"unix_ms\":\"" + unixMs + "\",";
  body += "\"rfc3339\":\"" + rfc + "\"";
  body += "}";

  Response.setStatus(200);
  Response.setHeader("content-type", "application/json");
  Response.setBodyString(body);
  return Response.respond();
}
