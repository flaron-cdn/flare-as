// WebSocket echo server. Replies to every incoming text frame with
// "echo: <original>". Logs open and close events.
//
// Demonstrates: ws_open, ws_message, ws_close exports, WS.send, WS.close.

import {
  alloc,
  resetArena,
  WS,
  WsEventType,
  Log,
} from "../../assembly/index";

export { alloc };

// Called by the host when a new WebSocket connection is established. The
// host invokes this AFTER the upgrade handshake has completed.
export function ws_open(): void {
  resetArena();
  Log.info("ws_open conn=" + WS.connId());
}

// Called by the host on every inbound message. WS.eventData() returns the
// raw payload bytes — for text frames the host hands you UTF-8.
export function ws_message(): void {
  resetArena();
  const payload = WS.eventDataString();
  WS.sendString("echo: " + payload);
}

// Called by the host when the connection is closing. WS.closeCode() returns
// the close code the remote peer sent (1000 = normal close).
export function ws_close(): void {
  resetArena();
  const code = WS.closeCode();
  Log.info("ws_close conn=" + WS.connId() + " code=" + code.toString());
}
