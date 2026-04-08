// Secret — read per-domain secrets the operator has provisioned. The flare
// must list each secret name in its `allowed_secrets` config; reading any
// other key returns null and the host logs a denial.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen, readPackedString } from "./io";

export class Secret {
  /// Read a secret value by name. Returns null if the secret is missing OR
  /// the flare is not allowlisted to read it.
  static get(name: string): string | null {
    const nameBuf = strToUtf8(name);
    const packed = env.secret_get(bytesPtr(nameBuf), bytesLen(nameBuf));
    return readPackedString(packed);
  }
}
