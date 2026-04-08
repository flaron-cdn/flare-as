// WS — WebSocket event handlers and outbound send. The flaron host invokes
// `ws_open` / `ws_message` / `ws_close` exports on your flare for each event;
// these accessors read the per-event data the host has staged.

import * as env from "./env";
import {
  strToUtf8,
  bytesPtr,
  bytesLen,
  readPackedString,
  readPackedBytes,
} from "./io";

export const enum WsEventType {
  Open = 0,
  Message = 1,
  Close = 2,
  Unknown = 3,
}

export const enum WsSendError {
  Ok = 0,
  Failed = 1,
}

export class WS {
  /// Send bytes back to the connected client. Returns WsSendError.Ok on
  /// success or WsSendError.Failed if the connection has gone away.
  static send(data: Uint8Array): WsSendError {
    return <WsSendError>env.ws_send(bytesPtr(data), bytesLen(data));
  }

  /// Convenience: send a UTF-8 text frame.
  static sendString(data: string): WsSendError {
    return WS.send(strToUtf8(data));
  }

  /// Close the WebSocket with the given status code (1000 = normal close).
  static close(code: i32): void {
    env.ws_close_conn(code);
  }

  /// The connection identifier for the current event. Stable for the
  /// lifetime of the connection.
  static connId(): string {
    const s = readPackedString(env.ws_conn_id());
    return s == null ? "" : s!;
  }

  /// "open", "message", or "close".
  static eventTypeString(): string {
    const s = readPackedString(env.ws_event_type());
    return s == null ? "" : s!;
  }

  /// Parsed event type as a typed enum.
  static eventType(): WsEventType {
    const s = WS.eventTypeString();
    if (s == "open") return WsEventType.Open;
    if (s == "message") return WsEventType.Message;
    if (s == "close") return WsEventType.Close;
    return WsEventType.Unknown;
  }

  /// Raw payload for ws_message events. Empty for open/close.
  static eventData(): Uint8Array {
    const b = readPackedBytes(env.ws_event_data());
    return b == null ? new Uint8Array(0) : b!;
  }

  /// Convenience: event payload decoded as UTF-8 string.
  static eventDataString(): string {
    const b = WS.eventData();
    if (b.length == 0) return "";
    return String.UTF8.decodeUnsafe(b.dataStart, b.byteLength, false);
  }

  /// WebSocket close code provided by the remote peer. Only meaningful for
  /// `ws_close` events.
  static closeCode(): i32 {
    return env.ws_close_code();
  }
}
