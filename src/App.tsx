import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertTriangle, Copy, Search, ShieldAlert, Server, ExternalLink, Users, Ghost, Bot, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Gauge } from './components/Gauge';
import { aggregate } from './lib/heuristics';
import type { ScanResponse, Snapshot, Player } from './lib/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LABELS: Record<string, { name: string; desc: string }> = {
  sequence_match: { name: 'Sequence Match', desc: 'Checa entradas repetidas na mesma sequencia.' },
  ping_cluster: { name: 'Ping Cluster', desc: 'Detecta grupos com ping muito parecido.' },
  name_pattern: { name: 'Name Pattern', desc: 'Detecta nomes genericos ou padrao repetido.' },
  session_spike: { name: 'Session Spike', desc: 'Sinaliza picos de entrada fora do normal.' },
  historical_fingerprint: { name: 'Historical Fingerprint', desc: 'Compara recorrencia de endpoints ao longo do tempo.' },
};

const LOCAL_SNAP_STORE = new Map<string, Snapshot[]>();

function parseQuery(q: string): { serverRef: string; type: 'serverId' | 'hash' | 'raw' } {
  const trimmed = q.trim();
  const cfxMatch = trimmed.match(/cfx\.re\/join\/([A-Za-z0-9]+)/i);
  if (cfxMatch) return { serverRef: cfxMatch[1], type: 'hash' };
  const detailMatch = trimmed.match(/servers\.fivem\.net\/servers\/detail\/([A-Za-z0-9]+)/i);
  if (detailMatch) return { serverRef: detailMatch[1], type: 'hash' };
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return { serverRef: trimmed, type: 'serverId' };
  return { serverRef: trimmed, type: 'raw' };
}

function stripColorCodes(s: string): string {
  try {
    return String(s).replace(/\^[0-9A-Za-z]/g, '').replace(/\s{2,}/g, ' ').trim();
  } catch {
    return s;
  }
}

export default function App() {
  const [query, setQuery] = useState('');
  const [jobId] = useState(`job-${Math.floor(Math.random() * 10000)}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const parsed = parseQuery(query);
      const serverRef = parsed.serverRef;
      const targetUrl = `https://servers-frontend.fivem.net/api/servers/single/${serverRef}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Erro no proxy: ${res.status}`);

      const proxyData = await res.json();
      if (!proxyData.contents) throw new Error('Nao foi possivel resolver o servidor.');

      const json = JSON.parse(proxyData.contents);
      if (!json.Data) throw new Error('Server ID ou link CFX invalido.');

      const serverNameRaw = String((json?.Data?.hostname ?? json?.Data?.server ?? json?.Data?.vars?.sv_hostname ?? '') || '');
      const serverName = serverNameRaw ? stripColorCodes(serverNameRaw) : undefined;

      const players: Player[] = (json?.Data?.players || []).map((p: any) => ({
        id: Number(p.id ?? 0),
        name: String(p.name ?? ''),
        ping: Number(p.ping ?? 0),
        endpoint: p.endpoint,
        identifiers: p.identifiers,
      }));

      const snap: Snapshot = { ts: new Date().toISOString(), players };
      const arr = LOCAL_SNAP_STORE.get(jobId) ?? [];

      if (arr.length > 0) {
        const last = arr[arr.length - 1];
        const lastIds = last.players.map((p) => p.id).join(',');
        const currentIds = snap.players.map((p) => p.id).join(',');
        if (lastIds !== currentIds) arr.push(snap);
      } else {
        arr.push(snap);
      }

      const limitedArr = arr.slice(-5);
      LOCAL_SNAP_STORE.set(jobId, limitedArr);

      const agg = aggregate(players, limitedArr);

      setResult({
        server: serverRef,
        server_name: serverName,
        player_count: players.length,
        estimated_bots: agg.estimatedBots,
        confidence: agg.confidence,
        reasons: agg.reasons,
        snapshots: limitedArr,
      });
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao consultar o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!result) return;
    const txt = `
[FiveCheck Report]
Server: ${result.server_name || result.server}
Players: ${result.player_count}
Estimated Bots: ${result.estimated_bots}
Confidence Score: ${result.confidence}%

Heuristics Breakdown:
${result.reasons.map((r) => `- ${LABELS[r.rule]?.name || r.rule}: ${(r.value * 100).toFixed(1)}%`).join('\n')}
    `.trim();
    navigator.clipboard.writeText(txt);
    alert('Relatorio copiado.');
  };

  const latestPlayers = result?.snapshots?.length ? result.snapshots[result.snapshots.length - 1].players : [];

  return (
    <div className="min-h-screen py-6 px-3 md:px-6 text-[var(--fg-1)]">
      <main className="app-shell">
        <header className="h-[58px] flex items-center justify-between px-5 border-b border-[#1f1f1f] bg-black/40">
          <div className="flex items-center gap-3">
            <span className="w-1 h-4 bg-white" />
            <h1 className="upper text-xs tracking-[0.27em] text-[#e6e6e6] font-bold">FiveCheck</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] upper text-[#858585]">
            <ShieldAlert className="w-4 h-4" /> Server Analyzer
          </div>
        </header>

        <section className="p-4 md:p-5 border-b border-[#242424] bg-black/30">
          <form onSubmit={handleScan} className="flex flex-col md:flex-row gap-2">
            <label className="panel h-11 flex-1 flex items-center px-3 gap-2">
              <Search className="w-4 h-4 text-[#6f7683]" />
              <input
                type="text"
                className="w-full bg-transparent outline-none text-[#f5f5f5] placeholder:text-[#6b7280] upper text-[12px]"
                placeholder="CFX join link, server id ou IP"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loading || !query}
              className="h-11 px-5 upper text-[11px] font-bold border border-[#2f2f2f] bg-[#111] text-[#d4d4d4] hover:bg-[#1a1a1a] hover:text-white disabled:opacity-50"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : 'Scan'}
            </button>
          </form>
        </section>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="m-4 panel p-3 flex items-center gap-2 text-[#fca5a5]">
              <AlertTriangle className="w-4 h-4" />
              <p className="upper text-[11px]">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {result && !error && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 md:p-5">
            <div className="panel p-4 flex flex-col items-center">
              <h2 className="upper text-[10px] text-[#6f7683] mb-3">Bot Probability</h2>
              <Gauge value={result.confidence} size={140} strokeWidth={12} className="mb-4" />
              <div className="w-full space-y-2">
                <div className="panel p-2 flex justify-between upper text-[11px]"><span>Total Players</span><strong>{result.player_count}</strong></div>
                <div className="panel p-2 flex justify-between upper text-[11px]"><span>Bot Estimate</span><strong className="text-[#f43f5e]">{result.estimated_bots}</strong></div>
              </div>
            </div>

            <div className="panel p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="upper text-[12px] text-white flex items-center gap-2"><Server className="w-4 h-4" /> {result.server_name || result.server}</h3>
                <span className="upper text-[10px] px-2 py-1 border border-[#2f2f2f] bg-[#111]">{result.server}</span>
              </div>
              <div className="space-y-2">
                {result.reasons.map((ruleStat, idx) => {
                  const labelInfo = LABELS[ruleStat.rule] || { name: ruleStat.rule, desc: 'Regra nao mapeada.' };
                  const percent = Math.round(ruleStat.value * 100);
                  return (
                    <div key={idx} className="panel p-3">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="upper text-[11px] text-[#f5f5f5]">{labelInfo.name}</p>
                          <p className="text-[11px] text-[#9ca3af]">{labelInfo.desc}</p>
                        </div>
                        <span className={cn('upper text-[10px] font-bold', percent > 50 ? 'text-[#f43f5e]' : percent > 20 ? 'text-[#eab308]' : 'text-[#10b981]')}>{percent}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#2c2c2c] mt-2">
                        <div className={cn('h-full', percent > 50 ? 'bg-[#f43f5e]' : percent > 20 ? 'bg-[#eab308]' : 'bg-[#10b981]')} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-[#2f2f2f] flex flex-col sm:flex-row gap-2">
                <button onClick={copyReport} className="h-10 px-4 panel upper text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-[#1a1a1a]"><Copy className="w-4 h-4" />Copy Report</button>
                <a href="https://support.cfx.re/hc/en-us/requests/new" target="_blank" rel="noreferrer" className="h-10 px-4 border border-[#2f2f2f] bg-[#111] upper text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-[#1a1a1a]"><ExternalLink className="w-4 h-4" />Report to CFX Support</a>
              </div>
            </div>

            <div className="panel p-4 lg:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="upper text-[12px] text-white flex items-center gap-2"><Users className="w-4 h-4" />Connected Players</h3>
                <span className="upper text-[10px] text-[#9ca3af]">{result.player_count} online</span>
              </div>

              <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                {latestPlayers.length === 0 ? (
                  <p className="upper text-[11px] text-[#6b7280]">Sem dados de jogadores.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(() => {
                      const nameFreq = latestPlayers.reduce((acc, p) => {
                        const low = p.name.toLowerCase();
                        acc[low] = (acc[low] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      return latestPlayers.map((player) => {
                        const isGeneric = /player\s*\d+|user\s*\d+|test|bot|unknown/i.test(player.name.trim().toLowerCase());
                        const cloneCount = nameFreq[player.name.toLowerCase()] || 0;
                        const isClone = cloneCount > 1;
                        const isHighPing = player.ping > 150;

                        const anomalies = [] as Array<{ id: string; label: string; icon: typeof Bot }>;
                        if (isGeneric) anomalies.push({ id: 'generic', label: 'Generic', icon: Bot });
                        if (isClone) anomalies.push({ id: 'clone', label: `Clone (${cloneCount}x)`, icon: Ghost });
                        if (isHighPing) anomalies.push({ id: 'ping', label: 'High Ping', icon: Clock });

                        return (
                          <div key={player.id} className="panel p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="upper text-[11px] text-[#f5f5f5] truncate">#{player.id} {player.name}</p>
                              <span className={cn('text-[10px] upper font-bold', player.ping > 150 ? 'text-[#f43f5e]' : player.ping > 80 ? 'text-[#eab308]' : 'text-[#10b981]')}>{player.ping}ms</span>
                            </div>
                            {anomalies.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {anomalies.map((a) => {
                                  const Icon = a.icon;
                                  return <span key={a.id} className="upper text-[10px] px-1 py-0.5 border border-[#2f2f2f] text-[#9ca3af] inline-flex items-center gap-1"><Icon className="w-3 h-3" />{a.label}</span>;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}