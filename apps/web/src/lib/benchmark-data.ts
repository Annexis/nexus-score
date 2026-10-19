import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { METHODOLOGY_VERSION, type BenchmarkSnapshot } from '@nexus-score/core';

const cache = new Map<string, { modified: number; data: BenchmarkSnapshot }>();

export function readBenchmarkSnapshot(era: 'overall' | 'current'): BenchmarkSnapshot | null {
  const filename = era === 'overall' ? 'leaderboard.json' : 'current-leaderboard.json';
  const path = join(process.cwd(), 'data', filename);
  if (!existsSync(path)) return null;
  const saved = cache.get(path);
  const modified = process.env.NODE_ENV === 'production' ? 0 : statSync(path).mtimeMs;
  if (saved && saved.modified === modified) return saved.data;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as BenchmarkSnapshot;
    cache.set(path, { modified, data });
    return data;
  } catch { return null; }
}

export function getBenchmarkSnapshots() {
  const overall = readBenchmarkSnapshot('overall');
  const current = readBenchmarkSnapshot('current');
  if (!overall || !current || overall.methodologyVersion !== METHODOLOGY_VERSION ||
      current.methodologyVersion !== METHODOLOGY_VERSION || overall.generatedAt !== current.generatedAt) return null;
  return { overall, current };
}
