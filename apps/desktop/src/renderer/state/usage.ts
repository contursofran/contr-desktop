import type { ContrApi, UsageRow } from "../../shared/api";

export interface UsageSnapshot {
  rows: UsageRow[];
  now: number;
}

export function subscribeUsage(api: Pick<ContrApi, "usage" | "onUsage">, onChange: (snapshot: UsageSnapshot) => void): () => void {
  const receive = (rows: UsageRow[]) => onChange({ rows, now: Date.now() });
  void api.usage().then(receive);
  return api.onUsage(receive);
}
