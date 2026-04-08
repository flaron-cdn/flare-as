// Plasma — cross-edge replicated KV with PN-counter semantics. Writes from
// any edge converge to the same value globally. Use for shared counters,
// rate limiters, and small replicated state.

import * as env from "./env";
import {
  strToUtf8,
  bytesPtr,
  bytesLen,
  readPackedBytes,
  readPackedString,
} from "./io";
import { unpackPtr, unpackLen } from "./memory";
import { parseStringArray } from "./json";

export const enum PlasmaSetError {
  Ok = 0,
  NotAvailable = 1,
  WriteLimit = 2,
  TooLarge = 3,
  BadKey = 4,
  NoCapability = 5,
  Internal = 6,
}

export class Plasma {
  /// Get a value as raw bytes. Returns null when the key does not exist.
  static get(key: string): Uint8Array | null {
    const keyBuf = strToUtf8(key);
    const packed = env.plasma_get(bytesPtr(keyBuf), bytesLen(keyBuf));
    return readPackedBytes(packed);
  }

  /// Convenience: get a value as a UTF-8 string.
  static getString(key: string): string | null {
    const bytes = Plasma.get(key);
    if (bytes == null) return null;
    if (bytes!.length == 0) return "";
    return String.UTF8.decodeUnsafe(bytes!.dataStart, bytes!.byteLength, false);
  }

  /// Set a value to raw bytes. Returns PlasmaSetError.Ok on success.
  static set(key: string, value: Uint8Array): PlasmaSetError {
    const keyBuf = strToUtf8(key);
    const code = env.plasma_set(
      bytesPtr(keyBuf),
      bytesLen(keyBuf),
      bytesPtr(value),
      bytesLen(value),
    );
    return <PlasmaSetError>code;
  }

  /// Convenience: set a string value.
  static setString(key: string, value: string): PlasmaSetError {
    return Plasma.set(key, strToUtf8(value));
  }

  /// Delete a key from the cross-edge store. The deletion is replicated to
  /// every other edge.
  static delete(key: string): PlasmaSetError {
    const keyBuf = strToUtf8(key);
    const code = env.plasma_delete(bytesPtr(keyBuf), bytesLen(keyBuf));
    return <PlasmaSetError>code;
  }

  /// Increment a counter atomically. Delta may be negative. Returns the new
  /// counter value. Returns 0 on error (key invalid, capability denied, …).
  /// The host wire format is an 8-byte LE u64 — read it directly.
  static increment(key: string, delta: i64): i64 {
    const keyBuf = strToUtf8(key);
    const packed = env.plasma_increment(bytesPtr(keyBuf), bytesLen(keyBuf), delta);
    return Plasma.decodeCounter(packed);
  }

  /// Decrement a counter atomically. Delta may be negative (which would
  /// effectively increment). Returns the new counter value or 0 on error.
  static decrement(key: string, delta: i64): i64 {
    const keyBuf = strToUtf8(key);
    const packed = env.plasma_decrement(bytesPtr(keyBuf), bytesLen(keyBuf), delta);
    return Plasma.decodeCounter(packed);
  }

  /// List all keys in the cross-edge store. Returns an empty array on error.
  static list(): string[] {
    const packed = env.plasma_list();
    const json = readPackedString(packed);
    if (json == null) return [];
    return parseStringArray(json!);
  }

  private static decodeCounter(packed: i64): i64 {
    if (packed == 0) return 0;
    const ptr = unpackPtr(packed);
    const len = unpackLen(packed);
    if (len < 8) return 0;
    return load<i64>(<usize>ptr);
  }
}
