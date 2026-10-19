export type BenchmarkEra = 'overall' | 'current';

export interface BenchmarkScope {
  contentType: string;
  era: BenchmarkEra;
}

export const DEFAULT_BENCHMARK_SCOPE: BenchmarkScope = {
  contentType: 'journal-article',
  era: 'current',
};

export function parseBenchmarkEra(value: string | string[] | undefined): BenchmarkEra {
  return value === 'overall' ? 'overall' : 'current';
}

export function parseContentType(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return 'all';
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 100 ? trimmed : 'all';
}

export function buildMemberHref(memberId: number | string, scope: BenchmarkScope): string {
  const params = new URLSearchParams({
    era: scope.era,
    contentType: scope.contentType,
  });
  return `/member/${memberId}?${params.toString()}`;
}

export function buildLeaderboardHref(scope: BenchmarkScope): string {
  const params = new URLSearchParams({ era: scope.era, contentType: scope.contentType });
  return `/leaderboard?${params.toString()}`;
}

export function getEraRange(referenceDate = new Date()): {
  currentStart: number;
  currentEnd: number;
  backfileBefore: number;
} {
  const currentEnd = referenceDate.getFullYear();
  const currentStart = currentEnd - 2;
  return { currentStart, currentEnd, backfileBefore: currentStart };
}

export function formatDataDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
