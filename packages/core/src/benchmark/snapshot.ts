import type { CrossrefMember } from '../crossref/types.js';
import type { ContentTypeCoverage, ContentTypeEraScore, Grade } from '../scoring/types.js';
import { calculateContentTypeScores, calculateScorableMemberScore, METHODOLOGY_VERSION } from '../scoring/calculator.js';
import { isScorableContentType } from '../scoring/content-types.js';
import { rankByScore } from '../ranking/competition.js';

export type BenchmarkDimensions = ContentTypeEraScore['dimensions'];
export interface BenchmarkContentType {
  type: string;
  label: string;
  score: number;
  grade: Grade;
  works: number;
  dimensions: BenchmarkDimensions;
  coverage: ContentTypeCoverage;
}
export interface BenchmarkEntry {
  rank: number;
  id: number;
  name: string;
  location?: string;
  score: number;
  grade: Grade;
  totalWorks: number;
  scopeWorks: number;
  excludedWorks: number;
  currentWorks: number;
  backfileWorks: number;
  currentScore: number | null;
  backfileScore: number | null;
  overallScore: number;
  improvement: number | null;
  dimensions: BenchmarkDimensions;
  currentDimensions?: BenchmarkDimensions;
  coverage: ContentTypeCoverage;
  contentTypes: BenchmarkContentType[];
}
export interface BenchmarkSnapshot {
  generatedAt: string;
  coverageCollectedAt?: string;
  fundingCollectedAt?: string;
  methodologyVersion: string;
  era: 'overall' | 'current';
  currentStart: number;
  currentEnd: number;
  totalMembers: number;
  totalRegisteredWithWorks: number;
  totalWithWorks: number;
  totalActive: number;
  notBenchmarked: number;
  availableContentTypes: { type: string; label: string; count: number }[];
  leaderboard: BenchmarkEntry[];
}

function label(type: string) {
  return type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One scoring implementation for both saved eras and live publisher profiles. */
export function buildBenchmarkSnapshots(members: CrossrefMember[], generatedAt = new Date().toISOString()) {
  const overall: BenchmarkEntry[] = [];
  const current: BenchmarkEntry[] = [];
  const available = { overall: new Map<string, number>(), current: new Map<string, number>() };
  let registered = 0;
  for (const member of members) {
    if (!(member.counts?.['total-dois'] > 0)) continue;
    registered++;
    for (const era of ['overall', 'current'] as const) {
      const counts = member['counts-type']?.[era === 'overall' ? 'all' : 'current'] ?? {};
      for (const [type, count] of Object.entries(counts)) {
        if (count > 0) available[era].set(type, (available[era].get(type) ?? 0) + 1);
      }
    }
    const scores = calculateScorableMemberScore(member);
    const types = calculateContentTypeScores(member['coverage-type'], member['counts-type']);
    for (const era of ['overall', 'current'] as const) {
      const primary = era === 'overall' ? scores.all : scores.current;
      if (!primary || !scores.all) continue;
      const contentTypes = types.flatMap((type): BenchmarkContentType[] => {
        if (!type.scorable) return [];
        const score = era === 'overall' ? type : type.current;
        const coverage = member['coverage-type'][era === 'overall' ? 'all' : 'current'][type.type];
        if (!score || !coverage || !score.works) return [];
        return [{ type: type.type, label: type.label, score: score.score, grade: score.grade,
          works: score.works, dimensions: score.dimensions, coverage }];
      });
      const entry: BenchmarkEntry = {
        rank: 0, id: member.id, name: member['primary-name'], location: member.location,
        score: primary.score, grade: primary.grade,
        totalWorks: member.counts['total-dois'], scopeWorks: primary.works, excludedWorks: primary.excludedWorks,
        currentWorks: scores.current?.works ?? 0, backfileWorks: scores.backfile?.works ?? 0,
        currentScore: scores.current?.score ?? null, backfileScore: scores.backfile?.score ?? null,
        overallScore: scores.all.score,
        improvement: scores.current && scores.backfile ? scores.current.score - scores.backfile.score : null,
        dimensions: primary.dimensions, currentDimensions: scores.current?.dimensions,
        coverage: primary.coverage, contentTypes,
      };
      (era === 'overall' ? overall : current).push(entry);
    }
  }
  const currentEnd = new Date(generatedAt).getUTCFullYear();
  const common = {
    generatedAt, methodologyVersion: METHODOLOGY_VERSION, currentStart: currentEnd - 2, currentEnd,
    totalMembers: members.length, totalRegisteredWithWorks: registered,
    totalWithWorks: overall.length, totalActive: current.length, notBenchmarked: registered - overall.length,
  };
  const build = (era: 'overall' | 'current', rows: BenchmarkEntry[]): BenchmarkSnapshot => ({
    ...common, era,
    availableContentTypes: [...available[era]].map(([type, count]) => ({ type, label: label(type), count }))
      .sort((a, b) => Number(isScorableContentType(b.type)) - Number(isScorableContentType(a.type)) || b.count - a.count),
    leaderboard: rankByScore(rows, (entry) => entry.score),
  });
  return { overall: build('overall', overall), current: build('current', current) };
}

export function scopedBenchmark(snapshot: BenchmarkSnapshot, contentType: string): BenchmarkEntry[] {
  if (contentType === 'all') return snapshot.leaderboard;
  if (!isScorableContentType(contentType)) return [];
  return rankByScore(snapshot.leaderboard.flatMap((entry) => {
    const type = entry.contentTypes.find((type) => type.type === contentType);
    return type ? [{ ...entry, score: type.score, grade: type.grade, scopeWorks: type.works,
      dimensions: type.dimensions, coverage: type.coverage }] : [];
  }), (entry) => entry.score);
}

export function summarizeBenchmark(rows: BenchmarkEntry[]) {
  const mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
  const scores = rows.map((row) => row.score).sort((a, b) => a - b);
  const n = scores.length;
  return {
    count: n, average: mean(scores),
    median: n ? (scores[Math.floor((n - 1) / 2)] + scores[Math.floor(n / 2)]) / 2 : null,
    distribution: (['A', 'B', 'C', 'D', 'F'] as const).map((grade) => ({ grade, count: rows.filter((row) => row.grade === grade).length })),
    dimensions: Object.fromEntries((['provenance', 'people', 'organizations', 'funding', 'access'] as const)
      .map((key) => [key, mean(rows.map((row) => row.dimensions[key]))])) as Record<keyof BenchmarkDimensions, number | null>,
    funderRor: mean(rows.flatMap((row) => typeof row.coverage['funder-ror-ids'] === 'number' ? [row.coverage['funder-ror-ids'] * 100] : [])),
  };
}

/** Compare the same IDs and scope, rather than attributing cohort changes to improvement. */
export function compareBenchmarkEras(overallRows: BenchmarkEntry[], currentRows: BenchmarkEntry[], threshold = 10) {
  const byId = new Map(overallRows.map((row) => [row.id, row]));
  const current = currentRows.filter((row) => byId.has(row.id));
  const overall = current.map((row) => byId.get(row.id)!);
  return {
    count: current.length,
    overall: summarizeBenchmark(overall), current: summarizeBenchmark(current),
    higher: current.filter((row) => row.score - byId.get(row.id)!.score >= threshold).length,
    lower: current.filter((row) => row.score - byId.get(row.id)!.score <= -threshold).length,
  };
}
