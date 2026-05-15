export type Player = {
  id: number;
  name: string;
  ping: number;
  identifiers?: string[];
  endpoint?: string;
};

export type Snapshot = {
  ts: string;
  players: Player[];
};

export type HeuristicResult = {
  rule: 'sequence_match' | 'ping_cluster' | 'name_pattern' | 'session_spike' | 'historical_fingerprint';
  value: number;
  detail?: string;
  detail_key?: string;
  detail_args?: Record<string, string | number>;
};

export type ScanResponse = {
  server: string;
  server_name?: string;
  player_count: number;
  estimated_bots: number;
  confidence: number;
  reasons: HeuristicResult[];
  snapshots: Snapshot[];
};
