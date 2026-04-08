// Minimal HTTP responder. Replies "Hello from Flaron!" to any request.
// Demonstrates: Request, Response, action encoding.

import { alloc, resetArena, Request, Response } from "../../assembly/index";

export { alloc };

export function handle_request(): i64 {
  resetArena();

  Response.setStatus(200);
  Response.setHeader("content-type", "text/plain; charset=utf-8");
  Response.setHeader("x-flare", "hello");
  Response.setBodyString("Hello from Flaron! You requested " + Request.url() + "\n");

  return Response.respond();
}
