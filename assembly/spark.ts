// Spark — per-site, per-edge, per-key KV store with TTL. Reads only see data
// written on this edge node; values are NOT replicated. Use Plasma for
// cross-edge state.

import * as env from "./env";
import {
  strToUtf8,
  bytesPtr,
  bytesLen,
  utf8ToStr,
  readPackedString,
} from "./io";
import { unpackPtr, unpackLen } from "./memory";
import { parseStringArray } from "./json";

/// SparkEntry is what spark_get returns when a key exists. The host wire
/// format is `4-byte LE u32 TTL || value bytes` and we strip the prefix here.
export class SparkEntry {
  value: Uint8Array;
  ttlSecs: u32;

  constructor(value: Uint8Array, ttlSecs: u32) {
    this.value = value;
    this.ttlSecs = ttlSecs;
  }

  /// Convenience: value decoded as a UTF-8 string.
  asString(): string {
    if (this.value.length == 0) return "";
    return String.UTF8.decodeUnsafe(this.value.dataStart, this.value.byteLength, false);
  }
}

/// SparkSetError mirrors the error codes the spark_set host function returns.
/// 0 means success and is not represented here.
export const enum SparkSetError {
  Ok = 0,
  InvalidTTL = 1,
  TooLarge = 2,
  WriteLimit = 3,
  Quota = 4,
  NotAvailable = 5,
  Internal = 6,
  ReadLimit = 7,
  BadKey = 8,
  NoCapability = 9,
}

export class Spark {
  /// Get a value. Returns null when the key does not exist or Spark is not
  /// configured. The 4-byte TTL prefix from the host wire format is stripped
  /// here so callers see only their value bytes.
  static get(key: string): SparkEntry | null {
    const keyBuf = strToUtf8(key);
    const packed = env.spark_get(bytesPtr(keyBuf), bytesLen(keyBuf));
    if (packed == 0) return null;
    const ptr = unpackPtr(packed);
    const len = unpackLen(packed);
    if (len < 4) return null;
    const ttl: u32 =
      (<u32>load<u8>(<usize>ptr)) |
      ((<u32>load<u8>(<usize>(ptr + 1))) << 8) |
      ((<u32>load<u8>(<usize>(ptr + 2))) << 16) |
      ((<u32>load<u8>(<usize>(ptr + 3))) << 24);
    const valLen = len - 4;
    const value = new Uint8Array(valLen);
    if (valLen > 0) {
      memory.copy(value.dataStart, <usize>(ptr + 4), <usize>valLen);
    }
    return new SparkEntry(value, ttl);
  }

  /// Convenience: get a value and decode as UTF-8. Returns null on miss.
  static getString(key: string): string | null {
    const entry = Spark.get(key);
    if (entry == null) return null;
    return entry!.asString();
  }

  /// Set a value with optional TTL in seconds. ttlSecs=0 means no expiry.
  /// Returns SparkSetError.Ok on success.
  static set(key: string, value: Uint8Array, ttlSecs: i32): SparkSetError {
    const keyBuf = strToUtf8(key);
    const code = env.spark_set(
      bytesPtr(keyBuf),
      bytesLen(keyBuf),
      bytesPtr(value),
      bytesLen(value),
      ttlSecs,
    );
    return <SparkSetError>code;
  }

  /// Convenience: set a string value with optional TTL.
  static setString(key: string, value: string, ttlSecs: i32): SparkSetError {
    return Spark.set(key, strToUtf8(value), ttlSecs);
  }

  /// Delete a key. Silently no-ops if the key does not exist or the flare
  /// lacks WritesSparkKV capability.
  static delete(key: string): void {
    const keyBuf = strToUtf8(key);
    env.spark_delete(bytesPtr(keyBuf), bytesLen(keyBuf));
  }

  /// List all keys for the current site. Returns an empty array if Spark is
  /// not configured. Use sparingly — list calls count against the read limit.
  static list(): string[] {
    const packed = env.spark_list();
    const json = readPackedString(packed);
    if (json == null) return [];
    return parseStringArray(json!);
  }

  /// Pull keys from another node's Spark store into this node. Returns the
  /// number of keys migrated, or a negative value on error. Rate-limited to
  /// one pull per invocation.
  static pull(originNode: string, keys: string[]): i32 {
    const origBuf = strToUtf8(originNode);
    let json = "[";
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) json += ",";
      json += "\"" + keys[i] + "\"";
    }
    json += "]";
    const keysBuf = strToUtf8(json);
    return env.spark_pull(
      bytesPtr(origBuf),
      bytesLen(origBuf),
      bytesPtr(keysBuf),
      bytesLen(keysBuf),
    );
  }
}
