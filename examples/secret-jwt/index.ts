// Sign a short-lived JWT for the requesting user. Reads the username from
// the X-User header, fetches the signing secret by name, and returns a JWT
// the client can present to a downstream API.
//
// Demonstrates: Secret.get, Crypto.signJWT, Time for expiry claims.

import {
  alloc,
  resetArena,
  Request,
  Response,
  Crypto,
  JwtAlgorithm,
  Secret,
  Time,
  TimeFormat,
} from "../../assembly/index";

export { alloc };

const SIGNING_SECRET = "jwt-signing-key";
const ISSUER = "flaron-edge";
const TTL_SECONDS: i64 = 300;

export function handle_request(): i64 {
  resetArena();

  const user = Request.header("x-user");
  if (user == null) {
    Response.setStatus(400);
    Response.setBodyString("missing X-User header");
    return Response.respond();
  }

  // Verify the secret is provisioned for this domain. We don't use the value
  // directly — Crypto.signJWT references it BY NAME and the host resolves it.
  const exists = Secret.get(SIGNING_SECRET);
  if (exists == null) {
    Response.setStatus(503);
    Response.setBodyString("signing secret not configured");
    return Response.respond();
  }

  const now = Time.nowUnix();
  const exp = now + TTL_SECONDS;

  const claimNames = ["sub", "iss", "iat", "exp"];
  const claimValues = [user!, ISSUER, now.toString(), exp.toString()];

  const jwt = Crypto.signJWT(JwtAlgorithm.HS256, SIGNING_SECRET, claimNames, claimValues);
  if (jwt.length == 0) {
    Response.setStatus(500);
    Response.setBodyString("jwt sign failed");
    return Response.respond();
  }

  Response.setStatus(200);
  Response.setHeader("content-type", "application/jwt");
  Response.setBodyString(jwt);
  return Response.respond();
}
