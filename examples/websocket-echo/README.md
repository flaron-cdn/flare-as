# websocket-echo

WebSocket echo server. Replies to every text frame with `echo: <original>`.
Logs open and close events with the connection ID and close code.

## What it demonstrates

- Exporting `ws_open`, `ws_message`, and `ws_close` for the host to invoke
- `WS.sendString()` to send a text frame back to the client
- `WS.eventDataString()` to read the inbound payload as UTF-8
- `WS.connId()` for the per-connection identifier
- `WS.closeCode()` to read the remote peer's close code

## Required configuration

The flare config must declare WebSocket support:

```json
{
  "websocket": true
}
```

## Build

```bash
npm run example:websocket-echo
```

## Test

```bash
websocat wss://your-domain.com/ws
> hello
< echo: hello
```
