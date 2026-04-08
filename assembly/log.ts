// Log — structured logging into the host's slog stream. Each invocation has
// a per-call message limit (100 lines) and a per-message size cap of 4096
// bytes; the host silently drops anything past those.

import * as env from "./env";
import { strToUtf8, bytesPtr, bytesLen } from "./io";

export class Log {
  static info(msg: string): void {
    const buf = strToUtf8(msg);
    env.log_info(bytesPtr(buf), bytesLen(buf));
  }

  static warn(msg: string): void {
    const buf = strToUtf8(msg);
    env.log_warn(bytesPtr(buf), bytesLen(buf));
  }

  static error(msg: string): void {
    const buf = strToUtf8(msg);
    env.log_error(bytesPtr(buf), bytesLen(buf));
  }
}
