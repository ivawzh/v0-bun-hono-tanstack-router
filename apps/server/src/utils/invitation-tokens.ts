import { randomUUID } from "crypto";

export function generateInvitationToken(): string {
  return randomUUID();
}

export function getInvitationExpiration(): Date {
  // Invitations expire after 7 days
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}