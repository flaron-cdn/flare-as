// Outbound HTTP fetch via Beam. Proxies to a fixed upstream URL with a
// custom header, then returns the upstream's response status and body to
// the client.
//
// Demonstrates: Beam.fetch with FetchOptions, header passthrough, status
// forwarding.

import {
  alloc,
  resetArena,
  Request,
  Response,
  Beam,
  FetchOptions,
} from "../../assembly/index";

export { alloc };

const UPSTREAM_URL = "https://api.github.com/zen";

export function handle_request(): i64 {
  resetArena();

  const opts = new FetchOptions();
  opts.method = "GET";
  opts.setHeader("user-agent", "flaron-flare/0.1");
  opts.setHeader("accept", "text/plain");

  const ua = Request.header("user-agent");
  if (ua != null) {
    opts.setHeader("x-original-ua", ua!);
  }

  const r = Beam.fetch(UPSTREAM_URL, opts);
  if (r == null) {
    Response.setStatus(502);
    Response.setBodyString("upstream fetch failed");
    return Response.respond();
  }

  Response.setStatus(r!.status);
  const upstreamCT = r!.getHeader("content-type");
  if (upstreamCT.length > 0) {
    Response.setHeader("content-type", upstreamCT);
  }
  Response.setHeader("x-proxied-by", "flaron-edge");
  Response.setBodyString(r!.body);
  return Response.respond();
}
