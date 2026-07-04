export const BETA_ACCESS_STATUSES = [
  "new",
  "contacted",
  "accepted",
  "rejected",
] as const;

export type BetaAccessStatus = (typeof BETA_ACCESS_STATUSES)[number];

export const BETA_ACCESS_STATUS_LABELS: Record<BetaAccessStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  accepted: "Accepté",
  rejected: "Refusé",
};


export function isBetaAccessStatus(value: string): value is BetaAccessStatus {
  return BETA_ACCESS_STATUSES.includes(value as BetaAccessStatus);
}
