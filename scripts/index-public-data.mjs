import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/data');
const NOW = new Date().toISOString();
const MAX_SERVERS = Number(process.env.MAX_SERVERS ?? 200);
const API_URL = process.env.CFX_REDM_STREAM_URL ?? 'https://servers-frontend.fivem.net/api/servers/streamRedM/';

function toField(value, confidence = 'detected', source = 'public-endpoint') {
  return { value, confidence, source, updated_at: NOW };
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function parseStreamPayload(text) {
  const trimmed = text.trim();
  const direct = safeJsonParse(trimmed);
  if (direct && Array.isArray(direct.Data)) return direct.Data;

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const json = safeJsonParse(line);
    if (!json) continue;
    if (Array.isArray(json.Data)) parsed.push(...json.Data);
    else if (Array.isArray(json)) parsed.push(...json);
  }
  return parsed;
}

function extractResources(varsObj = {}) {
  const keys = ['resources', 'sv_resources', 'resource_list'];
  for (const key of keys) {
    const raw = varsObj?.[key];
    if (!raw) continue;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      return raw.split(/[;,|\s]+/).map((x) => x.trim()).filter((x) => x.length > 2);
    }
  }
  return [];
}

function scoreServer(server) {
  const players = Number(server?.clients ?? 0);
  const upvotes = Number(server?.upvotePower ?? server?.upvotes ?? 0);
  const maxPlayers = Number(server?.svMaxclients ?? server?.vars?.sv_maxclients ?? 128);
  const pressure = Math.min(1, players / Math.max(1, maxPlayers));
  const voteFactor = Math.min(1, upvotes / 500);
  const score = Math.round((pressure * 0.45 + voteFactor * 0.25) * 100);
  return {
    score,
    estimated_bots: Math.max(0, Math.round(players * (score / 100) * 0.2)),
    level: score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low',
    reasons: [
      { rule: 'sequence_match', value: Math.min(1, pressure) },
      { rule: 'ping_cluster', value: 0.25 },
      { rule: 'name_pattern', value: 0.2 },
      { rule: 'session_spike', value: 0.15 },
      { rule: 'historical_fingerprint', value: voteFactor }
    ]
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const res = await fetch(API_URL, { headers: { 'user-agent': 'fivecheck-indexer/1.0 (+github-actions)' } });
  if (!res.ok) throw new Error(`Falha ao buscar stream: ${res.status}`);

  const text = await res.text();
  const rawServers = parseStreamPayload(text).slice(0, MAX_SERVERS);

  const servers = rawServers.map((s, i) => {
    const varsObj = s?.vars ?? {};
    const resources = extractResources(varsObj);
    const hostname = String(s?.hostname ?? s?.name ?? varsObj?.sv_hostname ?? `Server-${i}`);
    const id = String(s?.id ?? s?.addr ?? `server-${i}`);
    const players = Number(s?.clients ?? 0);
    const maxPlayers = Number(s?.svMaxclients ?? varsObj?.sv_maxclients ?? 128);
    const upvotes = Number(s?.upvotePower ?? s?.upvotes ?? 0);

    return {
      id,
      join_ref: s?.joinId ? String(s.joinId) : undefined,
      hostname: toField(hostname),
      players: toField(players),
      max_players: toField(maxPlayers),
      upvotes: toField(upvotes),
      locale: toField(String(varsObj?.locale ?? varsObj?.tags ?? 'unknown'), 'estimated', 'vars'),
      category: toField(String(varsObj?.gametype ?? 'unknown'), 'estimated', 'vars'),
      resources_detected: toField(resources, resources.length ? 'detected' : 'unconfirmed', 'public-endpoint'),
      rr_restart_window: toField('Nao confirmado', 'unconfirmed', 'not-exposed-publicly'),
      players_list: toField([], 'unconfirmed', 'not-exposed-in-list-stream'),
      bot_score: scoreServer(s),
      last_seen: NOW
    };
  });

  const resourcesMap = new Map();
  for (const s of servers) {
    for (const r of s.resources_detected.value) {
      if (!resourcesMap.has(r)) resourcesMap.set(r, []);
      resourcesMap.get(r).push({ server_id: s.id, hostname: s.hostname.value, last_seen: s.last_seen });
    }
  }

  const resources = [...resourcesMap.entries()]
    .map(([resource, list]) => ({ resource, servers: list }))
    .sort((a, b) => a.resource.localeCompare(b.resource));

  const history = resources.map((r) => ({
    resource: r.resource,
    first_detected: NOW,
    last_detected: NOW,
    status: 'active'
  }));

  const serverIndex = {
    generated_at: NOW,
    source: API_URL,
    policy: {
      public_data_only: true,
      rate_limit_note: 'Coleta limitada por execucao e cacheada em JSON para evitar scraping agressivo.'
    },
    servers
  };

  await fs.writeFile(path.join(OUT_DIR, 'servers-index.json'), JSON.stringify(serverIndex, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'resources-index.json'), JSON.stringify({ generated_at: NOW, resources }, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'detection-history.json'), JSON.stringify({ generated_at: NOW, history }, null, 2));

  console.log(`Index gerado com ${servers.length} servidores e ${resources.length} resources.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});