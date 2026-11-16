import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function newInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isInvitationToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
