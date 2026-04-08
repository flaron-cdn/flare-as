// String and byte conversion helpers between AssemblyScript managed types and
// raw guest-memory pointers used by the host ABI.

import { unpackPtr, unpackLen } from "./memory";

/// Encode a string to UTF-8 bytes wrapped in a Uint8Array. The returned view
/// owns its underlying buffer; callers must keep it alive while the host
/// reads from it. AS encodes strings as UTF-16 internally so this is a real
/// transcoding step.
export function strToUtf8(s: string): Uint8Array {
  // String.UTF8.encode returns an ArrayBuffer; wrapping it in a Uint8Array
  // gives us .dataStart and .byteLength which is what we need for the host
  // pointer/length pair. The `false` argument tells the runtime not to
  // append a NUL terminator (we pass explicit lengths everywhere).
  const buf = String.UTF8.encode(s, false);
  return Uint8Array.wrap(buf);
}

/// Read a UTF-8 string out of guest memory at `ptr` for `len` bytes. Used
/// when the host has written a string into the bump arena and returned a
/// packed (ptr, len) pair to us.
export function utf8ToStr(ptr: i32, len: i32): string {
  if (len <= 0) return "";
  return String.UTF8.decodeUnsafe(<usize>ptr, <usize>len, false);
}

/// Decode a packed (ptr, len) i64 returned by a host function into a string.
/// Returns null when the host signalled "not found" by returning 0.
export function readPackedString(packed: i64): string | null {
  if (packed == 0) return null;
  const ptr = unpackPtr(packed);
  const len = unpackLen(packed);
  return utf8ToStr(ptr, len);
}

/// Decode a packed (ptr, len) i64 returned by a host function into raw bytes.
/// Returns null when the host signalled "not found" by returning 0.
export function readPackedBytes(packed: i64): Uint8Array | null {
  if (packed == 0) return null;
  const ptr = unpackPtr(packed);
  const len = unpackLen(packed);
  if (len <= 0) return new Uint8Array(0);
  const out = new Uint8Array(len);
  memory.copy(out.dataStart, <usize>ptr, <usize>len);
  return out;
}

/// Pointer to the first byte of a Uint8Array's backing buffer. Required by
/// host functions that take an i32 ptr argument.
export function bytesPtr(buf: Uint8Array): i32 {
  return <i32>(buf.dataStart);
}

/// Length of a Uint8Array as i32. Convenience to avoid casting at every call site.
export function bytesLen(buf: Uint8Array): i32 {
  return <i32>(buf.byteLength);
}

/// Decode a hex-encoded string into raw bytes. Returns null on the first
/// invalid character — callers MUST treat this as a hard failure (corrupted
/// host response, never silently zero-fill). Used by Crypto.randomBytes.
export function hexDecode(hex: string): Uint8Array | null {
  const len = hex.length;
  if ((len & 1) != 0) return null;
  const out = new Uint8Array(len >> 1);
  for (let i = 0; i < len; i += 2) {
    const hi = hexNibble(hex.charCodeAt(i));
    if (hi < 0) return null;
    const lo = hexNibble(hex.charCodeAt(i + 1));
    if (lo < 0) return null;
    out[i >> 1] = <u8>((hi << 4) | lo);
  }
  return out;
}

function hexNibble(c: i32): i32 {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  return -1;
}
