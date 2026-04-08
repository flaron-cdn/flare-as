// Test guest module compiled by tests/runner.mjs and instantiated with mock
// flaron/v1 host imports. Each exported test_* function exercises one piece
// of the SDK and returns 1 on pass, 0 on fail. The Node test runner asserts
// on the return value AND inspects the recorded host calls.
//
// Keep this file in lockstep with the assertions in tests/runner.mjs — if
// you add a new test guest export, add a matching test() in runner.mjs.

import {
  alloc,
  resetArena,
  Request,
  Response,
  Spark,
  SparkSetError,
  SparkPullError,
  Plasma,
  Secret,
  Snowflake,
  Beam,
  FetchOptions,
  WS,
  WsEventType,
  Log,
  Crypto,
  HashAlgorithm,
  JwtAlgorithm,
  Encoding,
  ID,
  UuidVersion,
  Time,
  TimeFormat,
} from "../../assembly/index";

// Re-export alloc so the host can call into it for memory exchange.
export { alloc };

function bytesEqual(a: Uint8Array, b: Uint8Array): bool {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

// --- Request ---

export function test_request_method(): i32 {
  resetArena();
  return Request.method() == "POST" ? 1 : 0;
}

export function test_request_url(): i32 {
  resetArena();
  return Request.url() == "https://flaron.dev/path?key=value" ? 1 : 0;
}

export function test_request_header_present(): i32 {
  resetArena();
  const v = Request.header("authorization");
  return v != null && v! == "Bearer abc" ? 1 : 0;
}

export function test_request_header_missing(): i32 {
  resetArena();
  const v = Request.header("nope");
  return v == null ? 1 : 0;
}

export function test_request_body(): i32 {
  resetArena();
  const b = Request.body();
  if (b.length != 3) return 0;
  return b[0] == 0x66 && b[1] == 0x6f && b[2] == 0x6f ? 1 : 0;
}

// --- Response ---

export function test_response_set_status(): i32 {
  resetArena();
  Response.setStatus(201);
  return 1;
}

export function test_response_set_header(): i32 {
  resetArena();
  Response.setHeader("content-type", "application/json");
  return 1;
}

export function test_response_set_body_string(): i32 {
  resetArena();
  Response.setBodyString("hello");
  return 1;
}

export function test_action_respond(): i64 {
  resetArena();
  return Response.respond();
}

// --- Spark ---

export function test_spark_get_existing(): i32 {
  resetArena();
  const entry = Spark.get("user:123");
  if (entry == null) return 0;
  if (entry!.ttlSecs != 600) return 0;
  if (entry!.value.length != 3) return 0;
  if (entry!.value[0] != 0x66) return 0;
  if (entry!.value[1] != 0x6f) return 0;
  if (entry!.value[2] != 0x6f) return 0;
  return 1;
}

export function test_spark_get_missing(): i32 {
  resetArena();
  const entry = Spark.get("nope");
  return entry == null ? 1 : 0;
}

export function test_spark_set(): i32 {
  resetArena();
  const v = new Uint8Array(1);
  v[0] = 0x76;
  const code = Spark.set("k", v, 60);
  return code == SparkSetError.Ok ? 1 : 0;
}

export function test_spark_delete(): i32 {
  resetArena();
  Spark.delete("k");
  return 1;
}

export function test_spark_list(): i32 {
  resetArena();
  const keys = Spark.list();
  if (keys.length != 3) return 0;
  if (keys[0] != "a") return 0;
  if (keys[1] != "b") return 0;
  if (keys[2] != "c") return 0;
  return 1;
}

export function test_spark_pull_success(): i32 {
  resetArena();
  const r = Spark.pull("node-2", ["a", "b", "c"]);
  if (!r.ok) return 0;
  if (r.count != 3) return 0;
  if (r.error != SparkPullError.Ok) return 0;
  return 1;
}

export function test_spark_pull_zero_keys_migrated(): i32 {
  resetArena();
  const r = Spark.pull("node-2", ["x"]);
  if (!r.ok) return 0;
  if (r.count != 0) return 0;
  return 1;
}

export function test_spark_pull_write_limit_error(): i32 {
  resetArena();
  const r = Spark.pull("node-2", ["a"]);
  if (r.ok) return 0;
  if (r.count != 0) return 0;
  return r.error == SparkPullError.WriteLimit ? 1 : 0;
}

export function test_spark_pull_bad_key_error(): i32 {
  resetArena();
  const r = Spark.pull("node-2", ["a"]);
  if (r.ok) return 0;
  return r.error == SparkPullError.BadKey ? 1 : 0;
}

export function test_spark_pull_unknown_error(): i32 {
  resetArena();
  const r = Spark.pull("node-2", ["a"]);
  if (r.ok) return 0;
  return r.error == SparkPullError.Unknown ? 1 : 0;
}

// --- Plasma ---

export function test_plasma_get(): i32 {
  resetArena();
  const v = Plasma.get("k");
  if (v == null) return 0;
  if (v!.length != 2) return 0;
  if (v![0] != 0x68) return 0;
  if (v![1] != 0x69) return 0;
  return 1;
}

export function test_plasma_set(): i32 {
  resetArena();
  const v = new Uint8Array(3);
  v[0] = 1; v[1] = 2; v[2] = 3;
  return Plasma.set("k", v) == 0 ? 1 : 0;
}

export function test_plasma_delete(): i32 {
  resetArena();
  return Plasma.delete("k") == 0 ? 1 : 0;
}

export function test_plasma_increment(): i32 {
  resetArena();
  const result = Plasma.increment("counter", 5);
  return result == 105 ? 1 : 0;
}

export function test_plasma_decrement(): i32 {
  resetArena();
  const result = Plasma.decrement("counter", 5);
  return result == 95 ? 1 : 0;
}

export function test_plasma_list(): i32 {
  resetArena();
  const keys = Plasma.list();
  if (keys.length != 2) return 0;
  if (keys[0] != "x") return 0;
  if (keys[1] != "y") return 0;
  return 1;
}

// --- Secret ---

export function test_secret_get(): i32 {
  resetArena();
  const v = Secret.get("api-key");
  return v != null && v! == "supersecret" ? 1 : 0;
}

// --- Snowflake ---

export function test_snowflake_next(): i32 {
  resetArena();
  const id = Snowflake.next();
  return id == "9876543210987654321" ? 1 : 0;
}

// --- Beam ---

export function test_beam_fetch_simple(): i32 {
  resetArena();
  const r = Beam.fetch("https://api.example.com/users", null);
  if (r == null) return 0;
  if (r!.status != 201) return 0;
  if (r!.body != "created") return 0;
  if (r!.getHeader("x-custom") != "v") return 0;
  return 1;
}

export function test_beam_fetch_with_opts(): i32 {
  resetArena();
  const opts = new FetchOptions();
  opts.method = "POST";
  opts.body = "{\"k\":\"v\"}";
  opts.setHeader("content-type", "application/json");
  const r = Beam.fetch("https://api.example.com/post", opts);
  return r != null ? 1 : 0;
}

// --- Log ---

export function test_log_info(): i32 {
  resetArena();
  Log.info("hello world");
  return 1;
}

export function test_log_warn(): i32 {
  resetArena();
  Log.warn("warning");
  return 1;
}

export function test_log_error(): i32 {
  resetArena();
  Log.error("error");
  return 1;
}

// --- WS ---

export function test_ws_send(): i32 {
  resetArena();
  const data = new Uint8Array(2);
  data[0] = 0x68; data[1] = 0x69;
  return WS.send(data) == 0 ? 1 : 0;
}

export function test_ws_close(): i32 {
  resetArena();
  WS.close(1000);
  return 1;
}

export function test_ws_conn_id(): i32 {
  resetArena();
  return WS.connId() == "abc-123" ? 1 : 0;
}

export function test_ws_event_type(): i32 {
  resetArena();
  const t = WS.eventType();
  return t == WsEventType.Open ? 1 : 0;
}

export function test_ws_event_data(): i32 {
  resetArena();
  const d = WS.eventData();
  if (d.length != 4) return 0;
  if (d[0] != 1 || d[1] != 2 || d[2] != 3 || d[3] != 4) return 0;
  return 1;
}

export function test_ws_close_code(): i32 {
  resetArena();
  return WS.closeCode() == 1006 ? 1 : 0;
}

// --- Crypto ---

export function test_crypto_hash(): i32 {
  resetArena();
  const h = Crypto.hash(HashAlgorithm.SHA256, "data");
  return h == "deadbeefcafe" ? 1 : 0;
}

export function test_crypto_hmac(): i32 {
  resetArena();
  const h = Crypto.hmac("my-key", "data");
  return h == "abcdef" ? 1 : 0;
}

export function test_crypto_sign_jwt(): i32 {
  resetArena();
  const names = ["sub", "iss"];
  const values = ["user1", "flaron"];
  const jwt = Crypto.signJWT(JwtAlgorithm.HS256, "jwt-key", names, values);
  return jwt == "header.claims.sig" ? 1 : 0;
}

export function test_crypto_random_bytes(): i32 {
  resetArena();
  const b = Crypto.randomBytes(4);
  if (b == null) return 0;
  if (b!.length != 4) return 0;
  if (b![0] != 0xde) return 0;
  if (b![1] != 0xad) return 0;
  if (b![2] != 0xbe) return 0;
  if (b![3] != 0xef) return 0;
  return 1;
}

// --- Encoding ---

export function test_encoding_base64_encode(): i32 {
  resetArena();
  const data = new Uint8Array(5);
  data[0] = 0x68; data[1] = 0x65; data[2] = 0x6c; data[3] = 0x6c; data[4] = 0x6f;
  return Encoding.base64Encode(data) == "aGVsbG8=" ? 1 : 0;
}

export function test_encoding_base64_decode(): i32 {
  resetArena();
  const out = Encoding.base64Decode("aGVsbG8=");
  if (out.length != 5) return 0;
  return out[0] == 0x68 && out[1] == 0x65 && out[2] == 0x6c && out[3] == 0x6c && out[4] == 0x6f ? 1 : 0;
}

export function test_encoding_hex_encode(): i32 {
  resetArena();
  const data = new Uint8Array(5);
  data[0] = 0x68; data[1] = 0x65; data[2] = 0x6c; data[3] = 0x6c; data[4] = 0x6f;
  return Encoding.hexEncode(data) == "68656c6c6f" ? 1 : 0;
}

export function test_encoding_hex_decode(): i32 {
  resetArena();
  const out = Encoding.hexDecode("68656c6c6f");
  if (out.length != 5) return 0;
  return out[0] == 0x68 && out[1] == 0x65 && out[2] == 0x6c && out[3] == 0x6c && out[4] == 0x6f ? 1 : 0;
}

export function test_encoding_url_encode(): i32 {
  resetArena();
  return Encoding.urlEncode("hello world") == "hello%20world" ? 1 : 0;
}

export function test_encoding_url_decode(): i32 {
  resetArena();
  return Encoding.urlDecode("hello%20world") == "hello world" ? 1 : 0;
}

// --- ID ---

export function test_id_uuid(): i32 {
  resetArena();
  return ID.uuid(UuidVersion.V4) == "550e8400-e29b-41d4-a716-446655440000" ? 1 : 0;
}

export function test_id_ulid(): i32 {
  resetArena();
  return ID.ulid() == "01HZZTESTULIDABCDEFGHIJKLM" ? 1 : 0;
}

export function test_id_nanoid(): i32 {
  resetArena();
  return ID.nanoid(21) == "V1StGXR8_Z5jdHi6B-myT" ? 1 : 0;
}

export function test_id_ksuid(): i32 {
  resetArena();
  return ID.ksuid() == "1nfBmPkXN8K0L5q3J5rR4dq6T1A" ? 1 : 0;
}

export function test_id_snowflake(): i32 {
  resetArena();
  return ID.snowflake() == "1234567890123456789" ? 1 : 0;
}

// --- Time ---

export function test_time_now_ms(): i32 {
  resetArena();
  const ms = Time.nowMs();
  return ms == 1717977600000 ? 1 : 0;
}
