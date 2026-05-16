import type { DetectionHistory, ResourceIndex, ServerIndex } from './types';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function loadServerIndex() {
  return fetchJson<ServerIndex>('/data/servers-index.json');
}

export function loadResourceIndex() {
  return fetchJson<ResourceIndex>('/data/resources-index.json');
}

export function loadDetectionHistory() {
  return fetchJson<DetectionHistory>('/data/detection-history.json');
}