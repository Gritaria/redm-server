import React, { useEffect, useMemo, useState } from 'react';
import { Search, Server, Users, ThumbsUp, Clock3, ShieldAlert } from 'lucide-react';
import type { DetectionHistory, ResourceIndex, ServerIndex, ServerIndexEntry, ConfidenceTag } from './lib/types';
import { loadDetectionHistory, loadResourceIndex, loadServerIndex } from './lib/publicData';

function tagLabel(tag: ConfidenceTag) {
  if (tag === 'detected') return 'detectada';
  if (tag === 'estimated') return 'estimada';
  return 'nao confirmada';
}

function tagClass(tag: ConfidenceTag) {
  if (tag === 'detected') return 'text-[#10b981]';
  if (tag === 'estimated') return 'text-[#eab308]';
  return 'text-[#f97316]';
}

export default function App() {
  const [serverData, setServerData] = useState<ServerIndex | null>(null);
  const [resourceData, setResourceData] = useState<ResourceIndex | null>(null);
  const [historyData, setHistoryData] = useState<DetectionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [resourceQuery, setResourceQuery] = useState('');
  const [minPlayers, setMinPlayers] = useState(0);
  const [minUpvotes, setMinUpvotes] = useState(0);
  const [sortBy, setSortBy] = useState<'players' | 'upvotes'>('players');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        const [servers, resources, history] = await Promise.all([
          loadServerIndex(),
          loadResourceIndex(),
          loadDetectionHistory(),
        ]);
        setServerData(servers);
        setResourceData(resources);
        setHistoryData(history);
        setSelectedServerId(servers.servers[0]?.id ?? null);
      } catch (e: any) {
        setError(e?.message ?? 'Falha ao carregar dados publicos.');
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const filteredServers = useMemo(() => {
    const list = serverData?.servers ?? [];
    return list
      .filter((s) => s.players.value >= minPlayers)
      .filter((s) => s.upvotes.value >= minUpvotes)
      .filter((s) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          s.hostname.value.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.join_ref ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b[sortBy].value - a[sortBy].value);
  }, [serverData, minPlayers, minUpvotes, query, sortBy]);

  const selectedServer = useMemo(() => {
    if (!selectedServerId || !serverData) return null;
    return serverData.servers.find((s) => s.id === selectedServerId) ?? null;
  }, [selectedServerId, serverData]);

  const matchedResources = useMemo(() => {
    const q = resourceQuery.trim().toLowerCase();
    if (!resourceData) return [];
    if (!q) return resourceData.resources.slice(0, 20);
    return resourceData.resources.filter((r) => r.resource.toLowerCase().includes(q));
  }, [resourceData, resourceQuery]);

  const resourceHistoryMap = useMemo(() => {
    const map = new Map<string, DetectionHistory['history'][number]>();
    (historyData?.history ?? []).forEach((h) => map.set(h.resource, h));
    return map;
  }, [historyData]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center upper">Carregando base publica...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-[#f43f5e] upper">{error}</div>;
  }

  return (
    <div className="min-h-screen py-6 px-3 md:px-6">
      <main className="app-shell text-[var(--fg-1)]">
        <header className="h-[58px] flex items-center justify-between px-5 border-b border-[#1f1f1f] bg-black/40">
          <div className="flex items-center gap-3">
            <span className="w-1 h-4 bg-white" />
            <h1 className="upper text-xs tracking-[0.27em] text-[#e6e6e6] font-bold">FiveCheck Index</h1>
          </div>
          <div className="upper text-[10px] text-[#858585]">Dados publicos | Cache + Rate Limit</div>
        </header>

        <section className="p-4 border-b border-[#242424] bg-black/30 grid grid-cols-1 md:grid-cols-5 gap-2">
          <label className="panel h-10 px-3 flex items-center gap-2 md:col-span-2">
            <Search className="w-4 h-4 text-[#6f7683]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar servidor" className="bg-transparent w-full outline-none upper text-[11px]" />
          </label>
          <label className="panel h-10 px-3 flex items-center justify-between upper text-[11px]">
            Min players
            <input type="number" value={minPlayers} onChange={(e) => setMinPlayers(Number(e.target.value || 0))} className="w-16 bg-transparent text-right outline-none" />
          </label>
          <label className="panel h-10 px-3 flex items-center justify-between upper text-[11px]">
            Min upvotes
            <input type="number" value={minUpvotes} onChange={(e) => setMinUpvotes(Number(e.target.value || 0))} className="w-16 bg-transparent text-right outline-none" />
          </label>
          <label className="panel h-10 px-3 flex items-center justify-between upper text-[11px]">
            Ordenar
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'players' | 'upvotes')} className="bg-transparent outline-none">
              <option value="players">players</option>
              <option value="upvotes">upvotes</option>
            </select>
          </label>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-5 gap-3 p-4">
          <div className="panel xl:col-span-2 p-2 max-h-[520px] overflow-y-auto custom-scrollbar">
            <div className="upper text-[10px] text-[#6f7683] px-2 pb-2">Lista de Servidores ({filteredServers.length})</div>
            {filteredServers.map((s) => (
              <button key={s.id} onClick={() => setSelectedServerId(s.id)} className="w-full text-left panel mb-2 p-2 hover:bg-[#1a1a1a]">
                <div className="flex items-center justify-between gap-2">
                  <p className="upper text-[11px] text-white truncate">{s.hostname.value}</p>
                  <span className={`upper text-[10px] ${tagClass(s.hostname.confidence)}`}>{tagLabel(s.hostname.confidence)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9ca3af] upper">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{s.players.value}/{s.max_players.value}</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{s.upvotes.value}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="panel xl:col-span-3 p-3">
            {!selectedServer ? (
              <p className="upper text-[11px] text-[#6b7280]">Selecione um servidor.</p>
            ) : (
              <ServerDetail server={selectedServer} />
            )}
          </div>
        </section>

        <section className="p-4 border-t border-[#242424] bg-black/20">
          <h2 className="upper text-[12px] text-white mb-2">Busca Global de Resource/Script</h2>
          <label className="panel h-10 px-3 flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-[#6f7683]" />
            <input value={resourceQuery} onChange={(e) => setResourceQuery(e.target.value)} placeholder="Ex: ylx-memenu" className="bg-transparent w-full outline-none upper text-[11px]" />
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="panel p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
              {matchedResources.map((r) => {
                const h = resourceHistoryMap.get(r.resource);
                return (
                  <div key={r.resource} className="panel p-2 mb-2">
                    <p className="upper text-[11px] text-white">{r.resource}</p>
                    <p className="upper text-[10px] text-[#9ca3af]">Servidores detectados: {r.servers.length}</p>
                    {h && (
                      <p className="upper text-[10px] text-[#9ca3af]">Primeira: {h.first_detected} | Ultima: {h.last_detected} | Status: {h.status}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="panel p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
              {matchedResources[0] ? (
                matchedResources[0].servers.map((s) => (
                  <div key={`${matchedResources[0].resource}-${s.server_id}`} className="panel p-2 mb-2">
                    <p className="upper text-[11px] text-white">{s.hostname}</p>
                    <p className="upper text-[10px] text-[#9ca3af]">Server ID: {s.server_id}</p>
                    <p className="upper text-[10px] text-[#9ca3af]">Ultima deteccao: {s.last_seen}</p>
                  </div>
                ))
              ) : (
                <p className="upper text-[11px] text-[#6b7280]">Sem resultado.</p>
              )}
            </div>
          </div>
        </section>

        <section className="p-4 border-t border-[#242424]">
          <h2 className="upper text-[12px] text-white mb-2">Confianca dos dados</h2>
          <p className="upper text-[10px] text-[#10b981]">Detectada: veio direto de dado publico observado.</p>
          <p className="upper text-[10px] text-[#eab308]">Estimada: inferida por padrao historico/heuristica.</p>
          <p className="upper text-[10px] text-[#f97316]">Nao confirmada: sem observacao suficiente no momento.</p>
          <p className="upper text-[10px] text-[#9ca3af] mt-2 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Score de bot e probabilistico e nao substitui revisao humana.</p>
        </section>
      </main>
    </div>
  );
}

function ServerDetail({ server }: { server: ServerIndexEntry }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="upper text-[12px] text-white inline-flex items-center gap-2"><Server className="w-4 h-4" />{server.hostname.value}</h3>
        <span className={`upper text-[10px] ${tagClass(server.hostname.confidence)}`}>{tagLabel(server.hostname.confidence)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Metric label="Players" value={`${server.players.value}/${server.max_players.value}`} />
        <Metric label="Upvotes" value={`${server.upvotes.value}`} />
        <Metric label="Ultimo seen" value={server.last_seen} />
        <Metric label="Join ref" value={server.join_ref ?? 'n/a'} />
      </div>

      <div className="panel p-2 mb-2">
        <p className="upper text-[10px] text-[#6f7683] mb-1 inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />RR/restart</p>
        <p className="upper text-[11px] text-white">{server.rr_restart_window?.value ?? 'Nao informado'}</p>
        {server.rr_restart_window && <p className={`upper text-[10px] ${tagClass(server.rr_restart_window.confidence)}`}>{tagLabel(server.rr_restart_window.confidence)}</p>}
      </div>

      <div className="panel p-2 mb-2">
        <p className="upper text-[10px] text-[#6f7683] mb-1">Resources detectados</p>
        <div className="flex flex-wrap gap-1">
          {server.resources_detected.value.map((r) => (
            <span key={r} className="upper text-[10px] px-2 py-1 border border-[#2f2f2f]">{r}</span>
          ))}
        </div>
        <p className={`upper text-[10px] mt-1 ${tagClass(server.resources_detected.confidence)}`}>{tagLabel(server.resources_detected.confidence)}</p>
      </div>

      <div className="panel p-2 mb-2">
        <p className="upper text-[10px] text-[#6f7683] mb-1">Bot score</p>
        <p className="upper text-[11px] text-white">Score: {server.bot_score?.score ?? 0} | Nivel: {server.bot_score?.level ?? 'n/a'} | Estimativa bots: {server.bot_score?.estimated_bots ?? 0}</p>
      </div>

      <div className="panel p-2 max-h-[170px] overflow-y-auto custom-scrollbar">
        <p className="upper text-[10px] text-[#6f7683] mb-1">Lista de jogadores</p>
        {server.players_list?.value?.length ? (
          server.players_list.value.map((p) => (
            <div key={p.id} className="upper text-[10px] text-[#d4d4d4]">#{p.id} {p.name} ({p.ping}ms)</div>
          ))
        ) : (
          <p className="upper text-[10px] text-[#6b7280]">Nao confirmada neste ciclo.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-2">
      <p className="upper text-[10px] text-[#6f7683]">{label}</p>
      <p className="upper text-[11px] text-white truncate">{value}</p>
    </div>
  );
}