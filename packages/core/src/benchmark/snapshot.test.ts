import { describe, expect, it } from 'vitest';
import type { CrossrefMember, CoverageFields } from '../crossref/types.js';
import { calculateMemberScore, calculateScorableMemberScore, scoreFromSimplifiedCoverage, UnscorableMemberError } from '../scoring/calculator.js';
import { buildBenchmarkSnapshots, compareBenchmarkEras, scopedBenchmark, summarizeBenchmark } from './snapshot.js';

function coverage(overrides: Record<string, number> = {}): CoverageFields {
  return { references: 0, 'update-policies': 0, 'similarity-checking': 0, orcids: 0,
    affiliations: 0, 'affiliation-ror-ids': 0, 'funder-ror-ids': 0, 'ror-ids': 0,
    funders: 0, 'award-numbers': 0, licenses: 0, 'resource-links': 0, abstracts: 0, ...overrides };
}
function member(id: number, currentOrcid = 1, allOrcid = 0.5): CrossrefMember {
  return {
    id, 'primary-name': `Publisher ${id}`, location: 'Example',
    counts: { 'total-dois': 130, 'current-dois': 100, 'backfile-dois': 30 },
    'counts-type': { all: { 'journal-article': 30, 'peer-review': 100 }, current: { 'journal-article': 10, 'peer-review': 90 }, backfile: { 'journal-article': 20, 'peer-review': 10 } },
    'coverage-type': {
      all: { 'journal-article': coverage({ orcids: allOrcid }), 'peer-review': coverage() },
      current: { 'journal-article': coverage({ orcids: currentOrcid }), 'peer-review': coverage() },
      backfile: { 'journal-article': coverage(), 'peer-review': coverage() },
    },
  } as unknown as CrossrefMember;
}

describe('versioned benchmarks', () => {
  it('uses identical all-years and current scoring in snapshots and the public core API', () => {
    const m = member(1);
    const pair = buildBenchmarkSnapshots([m], '2026-10-19T00:00:00Z');
    const live = calculateMemberScore(m);
    expect(pair.overall.leaderboard[0].score).toBe(live.total);
    expect(pair.current.leaderboard[0].score).toBe(live.trend.currentScore);
    expect(pair.overall.leaderboard[0]).toMatchObject({ scopeWorks: 30, excludedWorks: 100, score: 10 });
    expect(pair.current.leaderboard[0]).toMatchObject({ scopeWorks: 10, excludedWorks: 90, score: 20 });
    expect(pair.overall.currentStart).toBe(2024);
    expect(pair.overall.generatedAt).toBe(pair.current.generatedAt);
  });

  it('does not credit funder ROR IDs as affiliation identifiers or add overlapping funding percentages', () => {
    const score = scoreFromSimplifiedCoverage(coverage({ affiliations: 1, 'ror-ids': 1, 'affiliation-ror-ids': 0, 'funder-ror-ids': 1, funders: 0.6 }));
    expect(score.dimensions.organizations).toBe(33);
    expect(score.metricDetails.organizations.metrics[1]).toMatchObject({ key: 'affiliation-ror-ids-current', value: 0 });
    expect(score.dimensions.funding).toBe(50);
  });

  it('keeps observed zero-score types and excludes members with no supported or complete coverage', () => {
    const zero = member(1, 0, 0);
    const unsupported = member(2);
    unsupported['counts-type'] = { all: { 'peer-review': 100 }, current: { 'peer-review': 90 }, backfile: { 'peer-review': 10 } };
    const incomplete = member(3);
    delete incomplete['coverage-type'].all['journal-article']['affiliation-ror-ids'];
    const pair = buildBenchmarkSnapshots([zero, unsupported, incomplete]);
    expect(pair.overall.leaderboard).toHaveLength(1);
    expect(pair.overall.leaderboard[0].score).toBe(0);
    expect(pair.overall.leaderboard[0].contentTypes[0]).toMatchObject({ score: 0, works: 30 });
    expect(pair.overall.notBenchmarked).toBe(2);
    expect(() => calculateMemberScore(unsupported)).toThrow(UnscorableMemberError);
    expect(calculateScorableMemberScore(incomplete).all).toBeNull();
  });

  it('preserves a missing era as unavailable rather than a measured zero', () => {
    const m = member(1);
    m['counts-type']!.backfile = {};
    const score = calculateMemberScore(m);
    expect(score.trend.backfileScore).toBeNull();
    expect(score.trend.change).toBeNull();
    expect(buildBenchmarkSnapshots([m]).overall.leaderboard[0].improvement).toBeNull();
  });

  it('assigns competition ranks consistently inside a supported content type', () => {
    const pair = buildBenchmarkSnapshots([member(1), member(2), member(3, 0)]);
    const rows = scopedBenchmark(pair.current, 'journal-article');
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3]);
    expect(scopedBenchmark(pair.current, 'peer-review')).toEqual([]);
    expect(summarizeBenchmark(rows)).toMatchObject({ count: 3, average: 13.3, median: 20 });
  });

  it('compares matching publisher IDs instead of different era populations, with an explicit threshold', () => {
    const pair = buildBenchmarkSnapshots([member(1), member(2), member(3)]);
    const compared = compareBenchmarkEras(pair.overall.leaderboard.slice(0, 2), pair.current.leaderboard.slice(1));
    expect(compared.count).toBe(1);
    expect(compared.overall.count).toBe(compared.current.count);
    expect(compared.higher).toBe(1); // 20 - 10 exactly meets the threshold.
    expect(compared.lower).toBe(0);
  });
});
