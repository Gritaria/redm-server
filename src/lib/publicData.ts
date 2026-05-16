import type { DetectionHistory, ResourceIndex, ServerIndex } from './types';

const base = import.meta.env.BASE_URL || '/';

function dataUrl(file: string) {
  return new URL(`data/${file}`, `https://local${base}`).pathname;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Falha ao carregar ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function loadServerIndex() {
  return fetchJson<ServerIndex>(dataUrl('servers-index.json'));
}

export function loadResourceIndex() {
  return fetchJson<ResourceIndex>(dataUrl('resources-index.json'));
}

export function loadDetectionHistory() {
  return fetchJson<DetectionHistory>(dataUrl('detection-history.json'));
}