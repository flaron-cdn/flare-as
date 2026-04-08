#!/usr/bin/env node
// Flaron AssemblyScript SDK test runner.
//
// Compiles tests/guest/test.ts into a wasm module, instantiates it with mock
// flaron/v1 host imports, then calls each exported test_* function. Each test
// function returns 1 on pass, 0 on fail. The mock host records calls so tests
// can verify that the SDK encoded arguments correctly and decoded results
// correctly.

import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const guestSrc = join(__dirname, "guest", "test.ts");
const guestBuildDir = join(__dirname, "guest", "build");
const guestWasm = join(guestBuildDir, "test.wasm");

await mkdir(guestBuildDir, { recursive: true });

async function compileGuest() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "npx",
      [
        "asc",
        guestSrc,
        "--outFile",
        guestWasm,
        "--runtime",
        "stub",
        "--exportRuntime",
        "--debug",
        "--sourceMap",
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`asc exited with code ${code}`));
    });
  });
}

await test("compile test guest", async () => {
  await compileGuest();
});

// MockHost provides scriptable responses for every flaron/v1 host function and
// records every call so tests can assert on argument encoding.
class MockHost {
  constructor() {
    this.reset();
  }

  reset() {
    this.calls = [];
    this.method = "GET";
    this.url = "https://example.com/path?q=1";
    this.requestHeaders = new Map([["x-test", "yes"]]);
    this.requestBody = new Uint8Array([0x68, 0x69]); // "hi"
    this.respStatus = 0;
    this.respHeaders = new Map();
    this.respBody = new Uint8Array();

    // KV stores
    this.sparkStore = new Map();
    this.sparkSetReturn = 0;
    this.plasmaStore = new Map();
    this.plasmaSetReturn = 0;
    this.plasmaCounters = new Map();
    this.plasmaListResult = [];
    this.sparkListResult = [];

    // Secrets
    this.secrets = new Map();

    // Fetch
    this.beamFetchReturn = {
      status: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    };
    this.beamFetchError = null;

    // WS
    this.wsConnId = "conn-1";
    this.wsEventType = "message";
    this.wsEventData = new Uint8Array([0x70, 0x69, 0x6e, 0x67]); // "ping"
    this.wsCloseCode = 0;
    this.wsSendReturn = 0;

    // Edge ops
    this.edgeOpsResults = {
      crypto_hash: "deadbeef",
      crypto_hmac: "abcdef",
      crypto_sign_jwt: "header.claims.sig",
      crypto_encrypt_aes: "ZW5jcnlwdGVk",
      crypto_decrypt_aes: "plaintext",
      crypto_random_bytes: "00112233",
      encoding_base64_encode: "aGVsbG8=",
      encoding_base64_decode: "hello",
      encoding_hex_encode: "68656c6c6f",
      encoding_hex_decode: "hello",
      encoding_url_encode: "hello%20world",
      encoding_url_decode: "hello world",
      id_uuid: "550e8400-e29b-41d4-a716-446655440000",
      id_ulid: "01HZZTESTULIDABCDEFGHIJKLM",
      id_nanoid: "V1StGXR8_Z5jdHi6B-myT",
      id_ksuid: "1nfBmPkXN8K0L5q3J5rR4dq6T1A",
      id_snowflake: "1234567890123456789",
      timestamp: "1717977600",
      snowflake_id: "9876543210987654321",
    };

    // Snowflake counter (separate from id_snowflake)
    this.lastLogs = [];
  }

  recordCall(name, args) {
    this.calls.push({ name, args });
  }

  // alloc bytes through the guest's exported alloc function and write data into them
  writeBytes(data) {
    if (data.length === 0) return 0n;
    const ptr = this.exports.alloc(data.length);
    if (ptr === 0) throw new Error("guest alloc returned 0");
    const mem = new Uint8Array(this.exports.memory.buffer);
    mem.set(data, ptr);
    return packPtrLen(ptr, data.length);
  }

  writeString(str) {
    return this.writeBytes(new TextEncoder().encode(str));
  }

  readBytes(ptr, len) {
    const mem = new Uint8Array(this.exports.memory.buffer);
    return mem.slice(ptr, ptr + len).slice();
  }

  readString(ptr, len) {
    return new TextDecoder().decode(this.readBytes(ptr, len));
  }

  imports() {
    const self = this;
    return {
      "flaron/v1": {
        // --- Request ---
        req_method: () => {
          self.recordCall("req_method", []);
          return self.writeString(self.method);
        },
        req_url: () => {
          self.recordCall("req_url", []);
          return self.writeString(self.url);
        },
        req_header_get: (namePtr, nameLen) => {
          const name = self.readString(namePtr, nameLen);
          self.recordCall("req_header_get", [name]);
          const v = self.requestHeaders.get(name.toLowerCase()) ?? self.requestHeaders.get(name);
          if (v === undefined) return 0n;
          return self.writeString(v);
        },
        req_body: () => {
          self.recordCall("req_body", []);
          return self.writeBytes(self.requestBody);
        },

        // --- Response ---
        resp_set_status: (status) => {
          self.recordCall("resp_set_status", [status]);
          self.respStatus = status;
        },
        resp_header_set: (namePtr, nameLen, valPtr, valLen) => {
          const name = self.readString(namePtr, nameLen);
          const value = self.readString(valPtr, valLen);
          self.recordCall("resp_header_set", [name, value]);
          self.respHeaders.set(name, value);
        },
        resp_body_set: (bodyPtr, bodyLen) => {
          const body = self.readBytes(bodyPtr, bodyLen);
          self.recordCall("resp_body_set", [body]);
          self.respBody = body;
        },

        // --- Spark ---
        spark_get: (keyPtr, keyLen) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("spark_get", [key]);
          const entry = self.sparkStore.get(key);
          if (!entry) return 0n;
          // Wire format: 4-byte LE u32 TTL + value bytes
          const ttl = entry.ttl >>> 0;
          const out = new Uint8Array(4 + entry.value.length);
          out[0] = ttl & 0xff;
          out[1] = (ttl >>> 8) & 0xff;
          out[2] = (ttl >>> 16) & 0xff;
          out[3] = (ttl >>> 24) & 0xff;
          out.set(entry.value, 4);
          return self.writeBytes(out);
        },
        spark_set: (keyPtr, keyLen, valPtr, valLen, ttl) => {
          const key = self.readString(keyPtr, keyLen);
          const value = self.readBytes(valPtr, valLen);
          self.recordCall("spark_set", [key, value, ttl]);
          if (self.sparkSetReturn === 0) {
            self.sparkStore.set(key, { value, ttl });
          }
          return self.sparkSetReturn;
        },
        spark_delete: (keyPtr, keyLen) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("spark_delete", [key]);
          self.sparkStore.delete(key);
        },
        spark_list: () => {
          self.recordCall("spark_list", []);
          return self.writeString(JSON.stringify(self.sparkListResult));
        },
        spark_pull: (origPtr, origLen, keysPtr, keysLen) => {
          const origin = self.readString(origPtr, origLen);
          const keys = self.readString(keysPtr, keysLen);
          self.recordCall("spark_pull", [origin, keys]);
          return self.sparkPullReturn ?? 0;
        },

        // --- Plasma ---
        plasma_get: (keyPtr, keyLen) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("plasma_get", [key]);
          const v = self.plasmaStore.get(key);
          if (v === undefined) return 0n;
          return self.writeBytes(v);
        },
        plasma_set: (keyPtr, keyLen, valPtr, valLen) => {
          const key = self.readString(keyPtr, keyLen);
          const value = self.readBytes(valPtr, valLen);
          self.recordCall("plasma_set", [key, value]);
          if (self.plasmaSetReturn === 0) {
            self.plasmaStore.set(key, value);
          }
          return self.plasmaSetReturn;
        },
        plasma_delete: (keyPtr, keyLen) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("plasma_delete", [key]);
          self.plasmaStore.delete(key);
          return 0;
        },
        plasma_increment: (keyPtr, keyLen, delta) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("plasma_increment", [key, delta]);
          const cur = (self.plasmaCounters.get(key) ?? 0n) + BigInt(delta);
          self.plasmaCounters.set(key, cur);
          // Wire format: 8-byte LE u64
          const out = new Uint8Array(8);
          const view = new DataView(out.buffer);
          view.setBigUint64(0, BigInt.asUintN(64, cur), true);
          return self.writeBytes(out);
        },
        plasma_decrement: (keyPtr, keyLen, delta) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("plasma_decrement", [key, delta]);
          const cur = (self.plasmaCounters.get(key) ?? 0n) - BigInt(delta);
          self.plasmaCounters.set(key, cur);
          const out = new Uint8Array(8);
          const view = new DataView(out.buffer);
          view.setBigUint64(0, BigInt.asUintN(64, cur), true);
          return self.writeBytes(out);
        },
        plasma_list: () => {
          self.recordCall("plasma_list", []);
          return self.writeString(JSON.stringify(self.plasmaListResult));
        },

        // --- Secrets ---
        secret_get: (keyPtr, keyLen) => {
          const key = self.readString(keyPtr, keyLen);
          self.recordCall("secret_get", [key]);
          const v = self.secrets.get(key);
          if (v === undefined) return 0n;
          return self.writeString(v);
        },

        // --- Snowflake ---
        snowflake_id: () => {
          self.recordCall("snowflake_id", []);
          return self.writeString(self.edgeOpsResults.snowflake_id);
        },

        // --- Beam ---
        beam_fetch: (urlPtr, urlLen, optsPtr, optsLen) => {
          const url = self.readString(urlPtr, urlLen);
          const opts = optsLen > 0 ? self.readString(optsPtr, optsLen) : "";
          self.recordCall("beam_fetch", [url, opts]);
          if (self.beamFetchError) {
            return self.writeString(JSON.stringify({ error: self.beamFetchError }));
          }
          return self.writeString(JSON.stringify(self.beamFetchReturn));
        },

        // --- Logging ---
        log_info: (ptr, len) => {
          const msg = self.readString(ptr, len);
          self.recordCall("log_info", [msg]);
          self.lastLogs.push({ level: "info", msg });
        },
        log_warn: (ptr, len) => {
          const msg = self.readString(ptr, len);
          self.recordCall("log_warn", [msg]);
          self.lastLogs.push({ level: "warn", msg });
        },
        log_error: (ptr, len) => {
          const msg = self.readString(ptr, len);
          self.recordCall("log_error", [msg]);
          self.lastLogs.push({ level: "error", msg });
        },

        // --- WS ---
        ws_send: (ptr, len) => {
          const data = self.readBytes(ptr, len);
          self.recordCall("ws_send", [data]);
          return self.wsSendReturn;
        },
        ws_close_conn: (code) => {
          self.recordCall("ws_close_conn", [code]);
        },
        ws_conn_id: () => {
          self.recordCall("ws_conn_id", []);
          return self.writeString(self.wsConnId);
        },
        ws_event_type: () => {
          self.recordCall("ws_event_type", []);
          return self.writeString(self.wsEventType);
        },
        ws_event_data: () => {
          self.recordCall("ws_event_data", []);
          return self.writeBytes(self.wsEventData);
        },
        ws_close_code: () => {
          self.recordCall("ws_close_code", []);
          return self.wsCloseCode;
        },

        // --- Edge ops ---
        crypto_hash: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("crypto_hash", [args]);
          return self.writeString(self.edgeOpsResults.crypto_hash);
        },
        crypto_hmac: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("crypto_hmac", [args]);
          return self.writeString(self.edgeOpsResults.crypto_hmac);
        },
        crypto_sign_jwt: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("crypto_sign_jwt", [args]);
          return self.writeString(self.edgeOpsResults.crypto_sign_jwt);
        },
        crypto_encrypt_aes: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("crypto_encrypt_aes", [args]);
          return self.writeString(self.edgeOpsResults.crypto_encrypt_aes);
        },
        crypto_decrypt_aes: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("crypto_decrypt_aes", [args]);
          return self.writeString(self.edgeOpsResults.crypto_decrypt_aes);
        },
        crypto_random_bytes: (length) => {
          self.recordCall("crypto_random_bytes", [length]);
          return self.writeString(self.edgeOpsResults.crypto_random_bytes);
        },
        encoding_base64_encode: (ptr, len) => {
          const data = self.readBytes(ptr, len);
          self.recordCall("encoding_base64_encode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_base64_encode);
        },
        encoding_base64_decode: (ptr, len) => {
          const data = self.readString(ptr, len);
          self.recordCall("encoding_base64_decode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_base64_decode);
        },
        encoding_hex_encode: (ptr, len) => {
          const data = self.readBytes(ptr, len);
          self.recordCall("encoding_hex_encode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_hex_encode);
        },
        encoding_hex_decode: (ptr, len) => {
          const data = self.readString(ptr, len);
          self.recordCall("encoding_hex_decode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_hex_decode);
        },
        encoding_url_encode: (ptr, len) => {
          const data = self.readString(ptr, len);
          self.recordCall("encoding_url_encode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_url_encode);
        },
        encoding_url_decode: (ptr, len) => {
          const data = self.readString(ptr, len);
          self.recordCall("encoding_url_decode", [data]);
          return self.writeString(self.edgeOpsResults.encoding_url_decode);
        },
        id_uuid: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("id_uuid", [args]);
          return self.writeString(self.edgeOpsResults.id_uuid);
        },
        id_ulid: () => {
          self.recordCall("id_ulid", []);
          return self.writeString(self.edgeOpsResults.id_ulid);
        },
        id_nanoid: (length) => {
          self.recordCall("id_nanoid", [length]);
          return self.writeString(self.edgeOpsResults.id_nanoid);
        },
        id_ksuid: () => {
          self.recordCall("id_ksuid", []);
          return self.writeString(self.edgeOpsResults.id_ksuid);
        },
        id_snowflake: () => {
          self.recordCall("id_snowflake", []);
          return self.writeString(self.edgeOpsResults.id_snowflake);
        },
        timestamp: (ptr, len) => {
          const args = self.readString(ptr, len);
          self.recordCall("timestamp", [args]);
          return self.writeString(self.edgeOpsResults.timestamp);
        },
      },
      env: {
        abort: (msgPtr, filePtr, line, col) => {
          throw new Error(`abort() at line ${line}:${col}`);
        },
      },
    };
  }
}

function packPtrLen(ptr, len) {
  return (BigInt(ptr) << 32n) | BigInt(len);
}

async function instantiate(host) {
  const bytes = await readFile(guestWasm);
  const { instance } = await WebAssembly.instantiate(bytes, host.imports());
  host.exports = instance.exports;
  return instance;
}

await test("Request.method returns the host method string", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.method = "POST";
  const ok = host.exports.test_request_method();
  assert.equal(ok, 1, "test_request_method should return 1");
  assert.deepEqual(
    host.calls.map((c) => c.name),
    ["req_method"],
  );
});

await test("Request.url returns the host URL string", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.url = "https://flaron.dev/path?key=value";
  const ok = host.exports.test_request_url();
  assert.equal(ok, 1);
});

await test("Request.header returns header value when present", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.requestHeaders.set("authorization", "Bearer abc");
  const ok = host.exports.test_request_header_present();
  assert.equal(ok, 1);
  assert.equal(host.calls[0].name, "req_header_get");
  assert.equal(host.calls[0].args[0], "authorization");
});

await test("Request.header returns empty string when missing", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_request_header_missing();
  assert.equal(ok, 1);
});

await test("Request.body returns the request body bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.requestBody = new Uint8Array([0x66, 0x6f, 0x6f]); // "foo"
  const ok = host.exports.test_request_body();
  assert.equal(ok, 1);
});

await test("Response.setStatus writes status to the host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_response_set_status();
  assert.equal(ok, 1);
  assert.equal(host.respStatus, 201);
});

await test("Response.setHeader writes header to the host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_response_set_header();
  assert.equal(ok, 1);
  assert.equal(host.respHeaders.get("content-type"), "application/json");
});

await test("Response.setBody writes body to the host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_response_set_body_string();
  assert.equal(ok, 1);
  assert.equal(new TextDecoder().decode(host.respBody), "hello");
});

await test("Response.respond returns Respond action encoded as i64", async () => {
  const host = new MockHost();
  await instantiate(host);
  const result = host.exports.test_action_respond();
  assert.equal(result, (1n << 32n));
});

await test("Spark.get strips the 4-byte TTL prefix and returns value bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.sparkStore.set("user:123", { value: new Uint8Array([0x66, 0x6f, 0x6f]), ttl: 600 });
  const ok = host.exports.test_spark_get_existing();
  assert.equal(ok, 1, "Spark.get should return 'foo' bytes after stripping TTL");
});

await test("Spark.get returns null when key is missing", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_spark_get_missing();
  assert.equal(ok, 1);
});

await test("Spark.set sends value and TTL to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_spark_set();
  assert.equal(ok, 1);
  assert.equal(host.calls[0].name, "spark_set");
  assert.equal(host.calls[0].args[0], "k");
  assert.deepEqual(host.calls[0].args[1], new Uint8Array([0x76]));
  assert.equal(host.calls[0].args[2], 60);
});

await test("Spark.delete sends key to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.sparkStore.set("k", { value: new Uint8Array([1]), ttl: 0 });
  const ok = host.exports.test_spark_delete();
  assert.equal(ok, 1);
  assert.equal(host.sparkStore.has("k"), false);
});

await test("Spark.list returns parsed key list", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.sparkListResult = ["a", "b", "c"];
  const ok = host.exports.test_spark_list();
  assert.equal(ok, 1);
});

await test("Plasma.get returns the stored bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.plasmaStore.set("k", new Uint8Array([0x68, 0x69]));
  const ok = host.exports.test_plasma_get();
  assert.equal(ok, 1);
});

await test("Plasma.set sends value to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_plasma_set();
  assert.equal(ok, 1);
});

await test("Plasma.delete removes the key", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.plasmaStore.set("k", new Uint8Array([1]));
  const ok = host.exports.test_plasma_delete();
  assert.equal(ok, 1);
});

await test("Plasma.increment returns the new counter value as i64", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.plasmaCounters.set("counter", 100n);
  const ok = host.exports.test_plasma_increment();
  assert.equal(ok, 1);
});

await test("Plasma.decrement returns the new counter value as i64", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.plasmaCounters.set("counter", 100n);
  const ok = host.exports.test_plasma_decrement();
  assert.equal(ok, 1);
});

await test("Plasma.list returns parsed key list", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.plasmaListResult = ["x", "y"];
  const ok = host.exports.test_plasma_list();
  assert.equal(ok, 1);
});

await test("Secret.get returns string value when allowed", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.secrets.set("api-key", "supersecret");
  const ok = host.exports.test_secret_get();
  assert.equal(ok, 1);
});

await test("Snowflake.next returns the host string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_snowflake_next();
  assert.equal(ok, 1);
});

await test("Beam.fetch sends URL and parses JSON response", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.beamFetchReturn = {
    status: 201,
    headers: { "x-custom": "v" },
    body: "created",
  };
  const ok = host.exports.test_beam_fetch_simple();
  assert.equal(ok, 1);
});

await test("Beam.fetch with options sends options JSON", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_beam_fetch_with_opts();
  assert.equal(ok, 1);
  const call = host.calls.find((c) => c.name === "beam_fetch");
  assert.ok(call.args[1].includes('"method":"POST"'));
});

await test("Log.info forwards message to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_log_info();
  assert.equal(ok, 1);
  assert.equal(host.lastLogs[0].level, "info");
  assert.equal(host.lastLogs[0].msg, "hello world");
});

await test("Log.warn forwards message to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_log_warn();
  assert.equal(ok, 1);
  assert.equal(host.lastLogs[0].level, "warn");
});

await test("Log.error forwards message to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_log_error();
  assert.equal(ok, 1);
  assert.equal(host.lastLogs[0].level, "error");
});

await test("WS.send forwards bytes to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_ws_send();
  assert.equal(ok, 1);
  assert.deepEqual(host.calls[0].args[0], new Uint8Array([0x68, 0x69]));
});

await test("WS.close sends close code", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_ws_close();
  assert.equal(ok, 1);
  assert.equal(host.calls[0].args[0], 1000);
});

await test("WS.connId reads conn id string from host", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.wsConnId = "abc-123";
  const ok = host.exports.test_ws_conn_id();
  assert.equal(ok, 1);
});

await test("WS.eventType reads event type from host", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.wsEventType = "open";
  const ok = host.exports.test_ws_event_type();
  assert.equal(ok, 1);
});

await test("WS.eventData reads event payload bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.wsEventData = new Uint8Array([1, 2, 3, 4]);
  const ok = host.exports.test_ws_event_data();
  assert.equal(ok, 1);
});

await test("WS.closeCode reads close code", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.wsCloseCode = 1006;
  const ok = host.exports.test_ws_close_code();
  assert.equal(ok, 1);
});

await test("Crypto.hash sends args envelope and returns string", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.edgeOpsResults.crypto_hash = "deadbeefcafe";
  const ok = host.exports.test_crypto_hash();
  assert.equal(ok, 1);
  const call = host.calls.find((c) => c.name === "crypto_hash");
  assert.ok(call.args[0].includes('"algorithm":"sha256"'));
});

await test("Crypto.hmac sends args envelope and returns string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_crypto_hmac();
  assert.equal(ok, 1);
  const call = host.calls.find((c) => c.name === "crypto_hmac");
  assert.ok(call.args[0].includes('"secret_key":"my-key"'));
});

await test("Crypto.signJWT sends claims envelope", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_crypto_sign_jwt();
  assert.equal(ok, 1);
  const call = host.calls.find((c) => c.name === "crypto_sign_jwt");
  assert.ok(call.args[0].includes('"claims"'));
});

await test("Crypto.randomBytes returns decoded bytes from hex", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.edgeOpsResults.crypto_random_bytes = "deadbeef";
  const ok = host.exports.test_crypto_random_bytes();
  assert.equal(ok, 1);
});

await test("Encoding.base64Encode forwards bytes to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_base64_encode();
  assert.equal(ok, 1);
});

await test("Encoding.base64Decode returns decoded bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_base64_decode();
  assert.equal(ok, 1);
});

await test("Encoding.hexEncode forwards bytes to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_hex_encode();
  assert.equal(ok, 1);
});

await test("Encoding.hexDecode returns decoded bytes", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_hex_decode();
  assert.equal(ok, 1);
});

await test("Encoding.urlEncode forwards string to host", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_url_encode();
  assert.equal(ok, 1);
});

await test("Encoding.urlDecode returns decoded string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_encoding_url_decode();
  assert.equal(ok, 1);
});

await test("ID.uuid sends version envelope", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_id_uuid();
  assert.equal(ok, 1);
});

await test("ID.ulid returns ULID string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_id_ulid();
  assert.equal(ok, 1);
});

await test("ID.nanoid returns nanoid string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_id_nanoid();
  assert.equal(ok, 1);
});

await test("ID.ksuid returns KSUID string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_id_ksuid();
  assert.equal(ok, 1);
});

await test("ID.snowflake returns snowflake string", async () => {
  const host = new MockHost();
  await instantiate(host);
  const ok = host.exports.test_id_snowflake();
  assert.equal(ok, 1);
});

await test("Time.now sends format envelope", async () => {
  const host = new MockHost();
  await instantiate(host);
  host.edgeOpsResults.timestamp = "1717977600000";
  const ok = host.exports.test_time_now_ms();
  assert.equal(ok, 1);
});
