export type Status = "ACTIVE" | "FINISHED" | "DORMANT" | "ROTTING" | "";

/** Mirrors the dict returned by `_serialize` in contracts/busfactor.py. */
export type Pact = {
  repo: string;
  package: string;
  steward: string;
  successor_handle: string;
  successor_addr: string;
  policy: string;
  registered: boolean;
  last_heartbeat: string;
  created_at: string;
  inquests: number;
  has_verdict: boolean;
  status: Status;
  urgency: number;
  headline: string;
  reasons_json: string;
  evidence_json: string;
  decided_at: string;
  decided_by: string;
  handover_armed: boolean;
};

export type Stats = {
  pacts: number;
  registered: number;
  inquests: number;
  heartbeats: number;
  active: number;
  finished: number;
  dormant: number;
  rotting: number;
};

/** The normalised, bucketed snapshot the validators actually judged. */
export type Evidence = {
  repo?: string;
  snapshot_day?: string;
  owner_login?: string;
  owner_type?: string;
  archived?: boolean;
  disabled?: boolean;
  is_fork?: boolean;
  license?: string;
  description?: string;
  stars?: string;
  forks?: string;
  open_threads?: string;
  since_last_push?: string;
  since_last_commit?: string;
  since_repo_created?: string;
  last_commit_by?: string;
  last_commit_by_owner?: boolean;
  maintainer_active_elsewhere?: string;
  maintainer_active_here?: boolean;
  self_declared_deprecated?: boolean;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
