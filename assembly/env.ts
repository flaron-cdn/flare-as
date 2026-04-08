// Host function declarations for the flaron/v1 ABI.
//
// Every function below is implemented by the flaron edge runtime and linked
// at module instantiation. Pointers are i32 indices into the guest's linear
// memory; lengths are i32 byte counts. Functions that return packed (ptr,len)
// pairs use i64 with the convention `(ptr << 32) | len` — see memory.ts.

// --- Request ---

@external("flaron/v1", "req_method")
export declare function req_method(): i64;

@external("flaron/v1", "req_url")
export declare function req_url(): i64;

@external("flaron/v1", "req_header_get")
export declare function req_header_get(namePtr: i32, nameLen: i32): i64;

@external("flaron/v1", "req_body")
export declare function req_body(): i64;

// --- Response ---

@external("flaron/v1", "resp_set_status")
export declare function resp_set_status(status: i32): void;

@external("flaron/v1", "resp_header_set")
export declare function resp_header_set(
  namePtr: i32,
  nameLen: i32,
  valPtr: i32,
  valLen: i32,
): void;

@external("flaron/v1", "resp_body_set")
export declare function resp_body_set(bodyPtr: i32, bodyLen: i32): void;

// --- Spark (per-site KV with TTL) ---

@external("flaron/v1", "spark_get")
export declare function spark_get(keyPtr: i32, keyLen: i32): i64;

@external("flaron/v1", "spark_set")
export declare function spark_set(
  keyPtr: i32,
  keyLen: i32,
  valPtr: i32,
  valLen: i32,
  ttlSecs: i32,
): i32;

@external("flaron/v1", "spark_delete")
export declare function spark_delete(keyPtr: i32, keyLen: i32): void;

@external("flaron/v1", "spark_list")
export declare function spark_list(): i64;

@external("flaron/v1", "spark_pull")
export declare function spark_pull(
  originPtr: i32,
  originLen: i32,
  keysPtr: i32,
  keysLen: i32,
): i32;

// --- Plasma (cross-edge CRDT KV) ---

@external("flaron/v1", "plasma_get")
export declare function plasma_get(keyPtr: i32, keyLen: i32): i64;

@external("flaron/v1", "plasma_set")
export declare function plasma_set(
  keyPtr: i32,
  keyLen: i32,
  valPtr: i32,
  valLen: i32,
): i32;

@external("flaron/v1", "plasma_delete")
export declare function plasma_delete(keyPtr: i32, keyLen: i32): i32;

@external("flaron/v1", "plasma_increment")
export declare function plasma_increment(
  keyPtr: i32,
  keyLen: i32,
  delta: i64,
): i64;

@external("flaron/v1", "plasma_decrement")
export declare function plasma_decrement(
  keyPtr: i32,
  keyLen: i32,
  delta: i64,
): i64;

@external("flaron/v1", "plasma_list")
export declare function plasma_list(): i64;

// --- Secrets ---

@external("flaron/v1", "secret_get")
export declare function secret_get(keyPtr: i32, keyLen: i32): i64;

// --- Snowflake ---

@external("flaron/v1", "snowflake_id")
export declare function snowflake_id(): i64;

// --- Beam (outbound HTTP fetch) ---

@external("flaron/v1", "beam_fetch")
export declare function beam_fetch(
  urlPtr: i32,
  urlLen: i32,
  optsPtr: i32,
  optsLen: i32,
): i64;

// --- Logging ---

@external("flaron/v1", "log_info")
export declare function log_info(msgPtr: i32, msgLen: i32): void;

@external("flaron/v1", "log_warn")
export declare function log_warn(msgPtr: i32, msgLen: i32): void;

@external("flaron/v1", "log_error")
export declare function log_error(msgPtr: i32, msgLen: i32): void;

// --- WebSocket ---

@external("flaron/v1", "ws_send")
export declare function ws_send(dataPtr: i32, dataLen: i32): i32;

@external("flaron/v1", "ws_close_conn")
export declare function ws_close_conn(code: i32): void;

@external("flaron/v1", "ws_conn_id")
export declare function ws_conn_id(): i64;

@external("flaron/v1", "ws_event_type")
export declare function ws_event_type(): i64;

@external("flaron/v1", "ws_event_data")
export declare function ws_event_data(): i64;

@external("flaron/v1", "ws_close_code")
export declare function ws_close_code(): i32;

// --- Edge ops: crypto ---

@external("flaron/v1", "crypto_hash")
export declare function crypto_hash(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "crypto_hmac")
export declare function crypto_hmac(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "crypto_sign_jwt")
export declare function crypto_sign_jwt(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "crypto_encrypt_aes")
export declare function crypto_encrypt_aes(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "crypto_decrypt_aes")
export declare function crypto_decrypt_aes(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "crypto_random_bytes")
export declare function crypto_random_bytes(length: i32): i64;

// --- Edge ops: encoding ---

@external("flaron/v1", "encoding_base64_encode")
export declare function encoding_base64_encode(ptr: i32, len: i32): i64;

@external("flaron/v1", "encoding_base64_decode")
export declare function encoding_base64_decode(ptr: i32, len: i32): i64;

@external("flaron/v1", "encoding_hex_encode")
export declare function encoding_hex_encode(ptr: i32, len: i32): i64;

@external("flaron/v1", "encoding_hex_decode")
export declare function encoding_hex_decode(ptr: i32, len: i32): i64;

@external("flaron/v1", "encoding_url_encode")
export declare function encoding_url_encode(ptr: i32, len: i32): i64;

@external("flaron/v1", "encoding_url_decode")
export declare function encoding_url_decode(ptr: i32, len: i32): i64;

// --- Edge ops: ID generators ---

@external("flaron/v1", "id_uuid")
export declare function id_uuid(argsPtr: i32, argsLen: i32): i64;

@external("flaron/v1", "id_ulid")
export declare function id_ulid(): i64;

@external("flaron/v1", "id_nanoid")
export declare function id_nanoid(length: i32): i64;

@external("flaron/v1", "id_ksuid")
export declare function id_ksuid(): i64;

@external("flaron/v1", "id_snowflake")
export declare function id_snowflake(): i64;

// --- Edge ops: timestamp ---

@external("flaron/v1", "timestamp")
export declare function timestamp(argsPtr: i32, argsLen: i32): i64;
