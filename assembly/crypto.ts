// Crypto — host-provided primitives for hashing, HMAC, JWT signing, AES, and
// random byte generation. Secret-using operations reference secrets BY NAME
// (the secret_key field) and the host resolves the actual key material from
// the per-domain secret store.

import * as env from "./env";
import {
  strToUtf8,
  bytesPtr,
  bytesLen,
  readPackedString,
  hexDecode,
} from "./io";
import { JsonObject } from "./json";

export const enum HashAlgorithm {
  SHA1 = 0,
  SHA256 = 1,
  SHA384 = 2,
  SHA512 = 3,
  MD5 = 4,
}

function hashAlgorithmName(a: HashAlgorithm): string {
  if (a == HashAlgorithm.SHA1) return "sha1";
  if (a == HashAlgorithm.SHA256) return "sha256";
  if (a == HashAlgorithm.SHA384) return "sha384";
  if (a == HashAlgorithm.SHA512) return "sha512";
  if (a == HashAlgorithm.MD5) return "md5";
  return "sha256";
}

export const enum JwtAlgorithm {
  HS256 = 0,
  HS384 = 1,
  HS512 = 2,
}

function jwtAlgorithmName(a: JwtAlgorithm): string {
  if (a == JwtAlgorithm.HS256) return "HS256";
  if (a == JwtAlgorithm.HS384) return "HS384";
  if (a == JwtAlgorithm.HS512) return "HS512";
  return "HS256";
}

export class Crypto {
  /// Compute a hash digest. Returns the digest as a hex-encoded string.
  static hash(algorithm: HashAlgorithm, input: string): string {
    const args = new JsonObject()
      .setString("algorithm", hashAlgorithmName(algorithm))
      .setString("input", input)
      .toString();
    return Crypto.callArgsFn(args, env.crypto_hash);
  }

  /// Compute an HMAC over `input` using a named secret stored in the flare's
  /// domain config. `secretKey` is the secret name, NOT the raw key material.
  /// Returns the HMAC as a hex-encoded string.
  static hmac(secretKey: string, input: string): string {
    const args = new JsonObject()
      .setString("secret_key", secretKey)
      .setString("input", input)
      .toString();
    return Crypto.callArgsFn(args, env.crypto_hmac);
  }

  /// Sign a JWT with HS256/HS384/HS512 using a named secret. Claims is a
  /// flat string-to-string map. Returns the signed compact JWT.
  static signJWT(
    algorithm: JwtAlgorithm,
    secretKey: string,
    claimNames: string[],
    claimValues: string[],
  ): string {
    if (claimNames.length != claimValues.length) return "";
    let claimsJson = "{";
    for (let i = 0; i < claimNames.length; i++) {
      if (i > 0) claimsJson += ",";
      claimsJson +=
        "\"" + claimNames[i] + "\":\"" + claimValues[i] + "\"";
    }
    claimsJson += "}";
    const args = new JsonObject()
      .setString("algorithm", jwtAlgorithmName(algorithm))
      .setString("secret_key", secretKey)
      .setRawObject("claims", claimsJson)
      .toString();
    return Crypto.callArgsFn(args, env.crypto_sign_jwt);
  }

  /// AES-encrypt a plaintext string using a named secret. Returns the
  /// base64-encoded ciphertext, or empty string on host error.
  static encryptAES(secretKey: string, input: string): string {
    const args = new JsonObject()
      .setString("secret_key", secretKey)
      .setString("input", input)
      .toString();
    return Crypto.callArgsFn(args, env.crypto_encrypt_aes);
  }

  /// AES-decrypt a base64-encoded ciphertext using a named secret. Returns
  /// the plaintext string, or empty string on host error.
  static decryptAES(secretKey: string, base64Ciphertext: string): string {
    const args = new JsonObject()
      .setString("secret_key", secretKey)
      .setString("input", base64Ciphertext)
      .toString();
    return Crypto.callArgsFn(args, env.crypto_decrypt_aes);
  }

  /// Generate `length` cryptographically random bytes (1..256). Returns null
  /// on host error or malformed hex response — callers MUST treat null as a
  /// hard failure (silent zero-fill would weaken any derived key/token).
  static randomBytes(length: i32): Uint8Array | null {
    const packed = env.crypto_random_bytes(length);
    const hex = readPackedString(packed);
    if (hex == null) return null;
    return hexDecode(hex!);
  }

  private static callArgsFn(
    argsJson: string,
    fn: (ptr: i32, len: i32) => i64,
  ): string {
    const buf = strToUtf8(argsJson);
    const packed = fn(bytesPtr(buf), bytesLen(buf));
    const s = readPackedString(packed);
    return s == null ? "" : s!;
  }
}
