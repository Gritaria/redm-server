import React, { useState, useEffect } from 'react';
import { Gauge } from './components/Gauge';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle, Copy, Search, ShieldAlert, Server, ExternalLink, Users, Ghost, Bot, Clock, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Component imported above


const LABELS: Record<string, { name: string; desc: string }> = {
  sequence_match: { name: 'Sequence Match', desc: 'Checks if identical groups of players join exactly in sequence.' },
  ping_cluster: { name: 'Ping Cluster', desc: 'Identifies clusters of identical pings, often meaning same host.' },
  name_pattern: { name: 'Name Pattern', desc: 'Finds generic names like "Player123" or duplicated names.' },
  session_spike: { name: 'Session Spike', desc: 'Sudden unrealistic join spikes.' },
  historical_fingerprint: { name: 'Historical Fingerprint', desc: 'Identifies specific endpoints returning repeatedly over time.' },
};

import { aggregate } from './lib/heuristics';
import type { ScanResponse, Snapshot, Player } from './lib/types';

// Keep snapshots across scans in memory
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
  const [jobId, setJobId] = useState(`job-${Math.floor(Math.random() * 10000)}`);
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
      // Use AllOrigins or Corsproxy to bypass CORS on Github Pages / Static envs
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        throw new Error(`Proxy error: ${res.status}`);
      }
      
      const proxyData = await res.json();
      if (!proxyData.contents) {
        throw new Error("Could not resolve server. CFX API might be blockig the request.");
      }
      
      const json = JSON.parse(proxyData.contents);
      if (!json.Data) {
        throw new Error('Invalid Server ID or CFX Join Link.');
      }
      
      const serverNameRaw = String((json?.Data?.hostname ?? json?.Data?.server ?? json?.Data?.vars?.sv_hostname ?? '') || '');
      const serverName = serverNameRaw ? stripColorCodes(serverNameRaw) : undefined;
      
      const players: Player[] = (json?.Data?.players || []).map((p: any) => ({
        id: Number(p.id ?? 0),
        name: String(p.name ?? ''),
        ping: Number(p.ping ?? 0),
        endpoint: p.endpoint,
        identifiers: p.identifiers
      }));

      // Snap store logic
      const snap: Snapshot = { ts: new Date().toISOString(), players };
      const arr = LOCAL_SNAP_STORE.get(jobId) ?? [];
      
      if (arr.length > 0) {
        const last = arr[arr.length - 1];
        const lastIds = last.players.map(p => p.id).join(',');
        const currentIds = snap.players.map(p => p.id).join(',');
        if (lastIds !== currentIds) {
          arr.push(snap);
        }
      } else {
        arr.push(snap);
      }
      
      const limitedArr = arr.slice(-5);
      LOCAL_SNAP_STORE.set(jobId, limitedArr);

      const agg = aggregate(players, limitedArr);

      const responseObj: ScanResponse = {
        server: serverRef,
        server_name: serverName,
        player_count: players.length,
        estimated_bots: agg.estimatedBots,
        confidence: agg.confidence,
        reasons: agg.reasons,
        snapshots: limitedArr
      };

      setResult(responseObj);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!result) return;
    const txt = `
[FiveCheck Automated Report]
Server: ${result.server_name || result.server}
Players: ${result.player_count}
Estimated Bots: ${result.estimated_bots}
Confidence Score: ${result.confidence}%

Heuristics Breakdown:
${result.reasons
  .map(r => `- ${LABELS[r.rule]?.name || r.rule}: ${(r.value * 100).toFixed(1)}%`)
  .join('\n')}
      `.trim();
    navigator.clipboard.writeText(txt);
    alert('Report copied to clipboard! You can now paste it in the CFX support ticket.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="flex flex-col items-center mb-12 text-center">
          <div className="bg-indigo-500/10 p-4 rounded-full mb-4 ring-1 ring-indigo-500/20">
            <ShieldAlert className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            FiveCheck
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Analyze FiveM/CFX servers for potential fake players and bots using advanced heuristics.
          </p>
        </header>

        {/* Search Input */}
        <form onSubmit={handleScan} className="relative max-w-2xl mx-auto mb-10 group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-32 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
            placeholder="CFX Join Link, Server ID, or IP..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !query}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-medium px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Activity className="w-4 h-4" />
              </motion.div>
            ) : (
              'Scan'
            )}
          </button>
        </form>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mb-8 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-3"
            >
              
              {/* Score Card */}
              <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-20"></div>
                <h3 className="text-slate-400 font-medium mb-6 uppercase tracking-wider text-xs">Bot Probability</h3>
                
                <Gauge value={result.confidence} size={140} strokeWidth={14} className="mb-6 drop-shadow-xl" />
                
                <div className="space-y-1 w-full">
                  <div className="bg-slate-950 rounded-lg p-3 flex justify-between items-center border border-slate-800/50">
                    <span className="text-slate-400 text-sm">Total Players</span>
                    <span className="font-mono text-white font-medium">{result.player_count}</span>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 flex justify-between items-center border border-slate-800/50">
                    <span className="text-slate-400 text-sm">Bot Estimate</span>
                    <span className="font-mono text-red-400 font-bold">{result.estimated_bots}</span>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-white font-semibold flex items-center gap-2">
                     <Server className="w-5 h-5 text-indigo-400" />
                     {result.server_name || result.server}
                   </h3>
                   <span className="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700">
                     {result.server}
                   </span>
                </div>

                <div className="space-y-4">
                  {result.reasons.map((ruleStat, idx) => {
                    const labelInfo = LABELS[ruleStat.rule] || { name: ruleStat.rule, desc: 'Unknown heuristic rule.' };
                    const percent = Math.round(ruleStat.value * 100);
                    
                    return (
                      <div key={idx} className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-sm font-medium text-slate-200">{labelInfo.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{labelInfo.desc}</p>
                          </div>
                          <span className={cn(
                            "text-xs font-bold px-2 py-1 rounded-md",
                            percent > 50 ? "bg-red-500/10 text-red-400" : percent > 20 ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"
                          )}>
                            {percent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-3">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: percent + "%" }}
                            transition={{ duration: 1, delay: idx * 0.1, ease: 'easeOut' }}
                            className={cn(
                              "h-full rounded-full",
                              percent > 50 ? "bg-red-500" : percent > 20 ? "bg-amber-500" : "bg-green-500"
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-800">
                  <button
                    onClick={copyReport}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors border border-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Report
                  </button>
                  <a
                    href="https://support.cfx.re/hc/en-us/requests/new"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-[2] flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 py-2.5 px-4 rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Report to CFX Support
                  </a>
                </div>
              </div>

              {/* Player List */}
              <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg mt-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Connected Players
                  </h3>
                  <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold">
                    {result.player_count} Online
                  </span>
                </div>
                
                <div className="bg-slate-950 border border-slate-800/50 rounded-xl overflow-hidden">
                  <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                    {(() => {
                      const latestPlayers = result.snapshots.length > 0 ? result.snapshots[result.snapshots.length - 1].players : [];
                      if (latestPlayers.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <Users className="w-10 h-10 mb-3 opacity-20" />
                            <p>No player data available.</p>
                          </div>
                        );
                      }

                      // Pre-calculate name frequencies for clones
                      const nameFreq = latestPlayers.reduce((acc, p) => {
                        const low = p.name.toLowerCase();
                        acc[low] = (acc[low] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {latestPlayers.map((player) => {
                            const isGeneric = /player\s*\d+|user\s*\d+|test|bot|unknown/i.test(player.name.trim().toLowerCase());
                            const cloneCount = nameFreq[player.name.toLowerCase()] || 0;
                            const isClone = cloneCount > 1;
                            const isHighPing = player.ping > 150;
                            
                            const anomalies = [];
                            if (isGeneric) anomalies.push({ id: 'generic', label: 'Generic', icon: Bot, cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' });
                            if (isClone) anomalies.push({ id: 'clone', label: `Clone (${cloneCount}x)`, icon: Ghost, cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' });
                            if (isHighPing) anomalies.push({ id: 'ping', label: 'High Ping', icon: Clock, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' });
                            
                            const isSus = anomalies.length > 0;

                            return (
                              <div key={player.id} className={cn(
                                "flex flex-col gap-2 bg-slate-900 border p-3 rounded-lg transition-colors relative overflow-hidden",
                                isSus ? "border-amber-900/40 hover:border-amber-700/60" : "border-slate-800 hover:border-slate-700"
                              )}>
                                {isSus && <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 blur-xl rounded-full translate-x-3 -translate-y-3" />}
                                <div className="flex justify-between items-center relative z-10">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-xs font-mono text-slate-500 shrink-0">#{player.id}</span>
                                    <span className={cn(
                                      "text-sm font-medium truncate",
                                      isSus ? "text-amber-100" : "text-slate-300"
                                    )} title={player.name}>{player.name}</span>
                                  </div>
                                  <div className={cn(
                                    "text-xs px-2 py-0.5 rounded ml-2 shrink-0 font-medium",
                                    player.ping > 150 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                    player.ping > 80 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                    "bg-green-500/10 text-green-400 border-green-500/20",
                                    "border"
                                  )}>
                                    {player.ping}ms
                                  </div>
                                </div>
                                
                                {anomalies.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-0.5 relative z-10">
                                    {anomalies.map(ano => {
                                      const Icon = ano.icon;
                                      return (
                                        <span key={ano.id} className={cn("flex items-center gap-1 px-1.5 py-0.5 border rounded-md text-[10px] font-medium uppercase tracking-wider", ano.cls)}>
                                          <Icon className="w-3 h-3" />
                                          {ano.label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                
                                {player.identifiers && player.identifiers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1 relative z-10">
                                    {player.identifiers.map(ident => {
                                      const [type, ...rest] = ident.split(':');
                                      const val = rest.join(':');
                                      if (type === 'ip') return null;
                                      return (
                                        <span key={ident} className="text-[10px] px-1.5 py-0.5 bg-slate-950 text-slate-400 rounded-md border border-slate-800/50 truncate max-w-full font-mono flex items-center" title={ident}>
                                          <span className="opacity-60 mr-1">{type}:</span>
                                          <span className="text-slate-300">{val.length > 12 ? val.substring(0, 12) + '...' : val}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

