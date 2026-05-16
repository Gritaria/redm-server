import { HeuristicResult, Player, Snapshot, BotScore } from './types';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function hSequenceMatch(snaps: Snapshot[]): HeuristicResult {
  if (snaps.length < 2) return { rule: 'sequence_match', value: 0 };
  let score = 0;
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1].players.map((p) => p.id).join(',');
    const b = snaps[i].players.map((p) => p.id).join(',');
    if (a === b) score += 1;
  }
  return { rule: 'sequence_match', value: score / (snaps.length - 1) };
}

export function hPingCluster(players: Player[]): HeuristicResult {
  if (players.length < 3) return { rule: 'ping_cluster', value: 0 };
  const pings = players.map((p) => p.ping).filter((p) => Number.isFinite(p));
  const mean = pings.reduce((a, b) => a + b, 0) / pings.length;
  const variance = pings.reduce((a, b) => a + (b - mean) ** 2, 0) / pings.length;
  const std = Math.sqrt(variance);
  const normalized = clamp01(1 - std / 50) * clamp01(1 - mean / 150);
  return { rule: 'ping_cluster', value: normalized, detail_args: { std: std.toFixed(1), mean: mean.toFixed(1) } };
}

export function hNamePattern(players: Player[]): HeuristicResult {
  if (players.length === 0) return { rule: 'name_pattern', value: 0 };
  const lower = players.map((p) => p.name.toLowerCase());
  const generic = lower.filter((n) => /player\s*\d+|user\s*\d+|test|bot|unknown/.test(n)).length;
  const repeated = players.length - new Set(lower).size;
  const value = clamp01((generic / players.length) * 0.6 + (repeated / players.length) * 0.4);
  return { rule: 'name_pattern', value, detail_args: { generic, repeated } };
}

export function hSessionSpike(snaps: Snapshot[]): HeuristicResult {
  if (snaps.length < 2) return { rule: 'session_spike', value: 0 };
  const counts = snaps.map((s) => s.players.length);
  let spike = 0;
  for (let i = 1; i < counts.length; i++) {
    spike = Math.max(spike, Math.abs(counts[i] - counts[i - 1]));
  }
  return { rule: 'session_spike', value: clamp01(spike / Math.max(10, counts[0] || 10)), detail_args: { spike } };
}

export function hHistoricalFingerprint(snaps: Snapshot[]): HeuristicResult {
  if (snaps.length < 2) return { rule: 'historical_fingerprint', value: 0 };
  const sets = snaps.map((s) => new Set(s.players.map((p) => p.endpoint ?? `${p.id}`)));
  let interScore = 0;
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1];
    const b = sets[i];
    let inter = 0;
    a.forEach((v) => {
      if (b.has(v)) inter += 1;
    });
    interScore += inter / Math.max(1, Math.max(a.size, b.size));
  }
  return { rule: 'historical_fingerprint', value: clamp01(interScore / (sets.length - 1)) };
}

export function scoreBotSuspicion(players: Player[], snaps: Snapshot[]): BotScore {
  const reasons = [
    hSequenceMatch(snaps),
    hPingCluster(players),
    hNamePattern(players),
    hSessionSpike(snaps),
    hHistoricalFingerprint(snaps),
  ];

  const weights: Record<string, number> = {
    sequence_match: 0.22,
    ping_cluster: 0.24,
    name_pattern: 0.22,
    session_spike: 0.16,
    historical_fingerprint: 0.16,
  };

  const raw = reasons.reduce((acc, r) => acc + r.value * (weights[r.rule] ?? 0.1), 0);
  const score = Math.round(clamp01(raw) * 100);
  const estimated_bots = Math.max(0, Math.round(players.length * clamp01(raw) * 0.55));
  const level: BotScore['level'] = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';

  return { score, estimated_bots, level, reasons };
}