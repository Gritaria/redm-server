export type ConfidenceTag = 'detected' | 'estimated' | 'unconfirmed';

export type DataField<T> = {
  value: T;
  confidence: ConfidenceTag;
  source?: string;
  updated_at?: string;
};

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

export type BotScore = {
  score: number;
  estimated_bots: number;
  level: 'low' | 'medium' | 'high';
  reasons: HeuristicResult[];
};

export type ServerIndexEntry = {
  id: string;
  join_ref?: string;
  hostname: DataField<string>;
  players: DataField<number>;
  max_players: DataField<number>;
  upvotes: DataField<number>;
  locale?: DataField<string>;
  category?: DataField<string>;
  resources_detected: DataField<string[]>;
  rr_restart_window?: DataField<string>;
  players_list?: DataField<Player[]>;
  bot_score?: BotScore;
  last_seen: string;
};

export type ServerIndex = {
  generated_at: string;
  source: string;
  policy: {
    public_data_only: boolean;
    rate_limit_note: string;
  };
  servers: ServerIndexEntry[];
};

export type ResourceHistoryEntry = {
  resource: string;
  first_detected: string;
  last_detected: string;
  status: 'active' | 'stale' | 'unknown';
};

export type ResourceIndexEntry = {
  resource: string;
  servers: Array<{
    server_id: string;
    hostname: string;
    last_seen: string;
  }>;
};

export type ResourceIndex = {
  generated_at: string;
  resources: ResourceIndexEntry[];
};

export type DetectionHistory = {
  generated_at: string;
  history: ResourceHistoryEntry[];
};