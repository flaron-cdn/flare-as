// Encoding — base64, hex, and URL encode/decode via the host. The host's
// implementations are vetted and constant-time where it matters; doing it in
// guest code would just bloat the wasm.

import * as env from "./env";
import {
  strToUtf8,
  bytesPtr,
  bytesLen,
  readPackedString,
  readPackedBytes,
} from "./io";

export class Encoding {
  static base64Encode(data: Uint8Array): string {
    const packed = env.encoding_base64_encode(bytesPtr(data), bytesLen(data));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }

  static base64EncodeString(data: string): string {
    return Encoding.base64Encode(strToUtf8(data));
  }

  static base64Decode(encoded: string): Uint8Array {
    const buf = strToUtf8(encoded);
    const packed = env.encoding_base64_decode(bytesPtr(buf), bytesLen(buf));
    const bytes = readPackedBytes(packed);
    return bytes == null ? new Uint8Array(0) : bytes!;
  }

  static hexEncode(data: Uint8Array): string {
    const packed = env.encoding_hex_encode(bytesPtr(data), bytesLen(data));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }

  static hexDecode(encoded: string): Uint8Array {
    const buf = strToUtf8(encoded);
    const packed = env.encoding_hex_decode(bytesPtr(buf), bytesLen(buf));
    const bytes = readPackedBytes(packed);
    return bytes == null ? new Uint8Array(0) : bytes!;
  }

  static urlEncode(input: string): string {
    const buf = strToUtf8(input);
    const packed = env.encoding_url_encode(bytesPtr(buf), bytesLen(buf));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }

  static urlDecode(input: string): string {
    const buf = strToUtf8(input);
    const packed = env.encoding_url_decode(bytesPtr(buf), bytesLen(buf));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }
}
