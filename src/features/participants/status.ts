export function invitationStatus(status: string, expiresAt: string) {
  return status === "pending" && new Date(expiresAt).getTime() <= Date.now() ? "expired" : status;
}
