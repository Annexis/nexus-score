import { describe, expect, it } from 'vitest';
import type { CoverageFields, CrossrefMember } from './types.js';
import { completeFundingCoverage, fundingCoverage, fundingOnlyCounts, FUNDING_UNION_FIELD, needsFundingSupplement, type FundingOnlyWork } from './funding.js';
import { calculateMemberScore, calculateScorableMemberScore, calculateScoreFromCoverage, scoreFromSimplifiedCoverage } from '../scoring/calculator.js';
import { buildBenchmarkSnapshots } from '../benchmark/snapshot.js';
import { FUNDING_METRICS, DIMENSION_WEIGHTS } from '../scoring/weights.js';

const coverage = (funders: number, ror: number, awards = 0.5): CoverageFields => ({
  funders, 'funder-ror-ids': ror, 'award-numbers': awards, 'affiliation-ror-ids': 0,
  affiliations: 0, abstracts: 0, references: 0, orcids: 0, licenses: 0, 'ror-ids': ror,
  'update-policies': 0, 'resource-links': 0, 'similarity-checking': 0,
});
function member(): CrossrefMember {
  return { id: 123, 'primary-name': 'Mixed identifiers',
    counts: { 'total-dois': 10, 'current-dois': 5, 'backfile-dois': 5 },
    'counts-type': { all: { 'journal-article': 10 }, current: { 'journal-article': 5 }, backfile: { 'journal-article': 5 } },
    'coverage-type': { all: { 'journal-article': coverage(0.4, 0.4) }, current: { 'journal-article': coverage(0.2, 0.6) }, backfile: { 'journal-article': coverage(0.6, 0.2) } },
  } as unknown as CrossrefMember;
}
const work = (DOI: string, year = 2026): FundingOnlyWork => ({ DOI, member: '123', type: 'journal-article', issued: { 'date-parts': [[year]] } });

describe('funding identifier union', () => {
  it('retains the existing 10 + 10 weights and all dimension weights', () => {
    expect(FUNDING_METRICS.map((metric) => metric.weight)).toEqual([10, 10]);
    expect(DIMENSION_WEIGHTS).toEqual({ provenance: 25, people: 20, organizations: 15, funding: 20, access: 20 });
  });

  it('uses the existing endpoint directly for legacy-only, ROR-only, and full-coverage cases', () => {
    expect(fundingCoverage(coverage(0.6, 0))).toBe(0.6);
    expect(fundingCoverage(coverage(0, 0.6))).toBe(0.6);
    expect(fundingCoverage(coverage(1, 1))).toBe(1);
    expect(fundingCoverage(coverage(0.3, 1))).toBe(1);
    const scored = scoreFromSimplifiedCoverage(coverage(1, 1, 0));
    expect(scored.metricDetails.funding.score).toBe(10); // Both IDs still earn one 10-point component.
    expect(scored.metricDetails.organizations.score).toBe(0); // Funding ROR is never affiliation ROR.
  });

  it('refuses to invent overlap by summing or taking the larger marginal percentage', () => {
    expect(fundingCoverage(coverage(0.6, 0.4))).toBeNull();
    expect(() => scoreFromSimplifiedCoverage(coverage(0.6, 0.4))).toThrow('overlap is not resolved');
    expect(fundingCoverage({ ...coverage(0.6, 0.4), [FUNDING_UNION_FIELD]: 0.7 })).toBe(0.7);
    expect(fundingCoverage({ ...coverage(0.6, 0.4), [FUNDING_UNION_FIELD]: 1.1 })).toBeNull();
  });

  it('uses the same funding union in the public partial-coverage utility', () => {
    expect(calculateScoreFromCoverage({ 'funders-current': 0, 'funder-ror-ids-current': 0.6 })).toBe(6);
    expect(calculateScoreFromCoverage({ 'funders-current': 1, 'funder-ror-ids-current': 1 })).toBe(10);
    expect(calculateScoreFromCoverage({ 'funders-current': 0.4, 'funder-ror-ids-current': 0.4, 'funders-including-ror-current': 0.6 })).toBe(6);
    expect(() => calculateScoreFromCoverage({ 'funders-current': 0.4, 'funder-ror-ids-current': 0.4 })).toThrow('overlap is not resolved');
  });

  it('adds only disjoint records, deduplicating DOIs across pages and identifier representations', () => {
    const raw = member();
    const corrected = completeFundingCoverage([raw], [work('10.test/a'), work('10.TEST/A'), work('10.test/b'), work('10.test/c', 2020)], 2026)[0];
    expect(raw['coverage-type'].all['journal-article'][FUNDING_UNION_FIELD]).toBeUndefined();
    expect(corrected['coverage-type'].all['journal-article'].funders).toBe(0.4);
    expect(corrected['coverage-type'].all['journal-article'][FUNDING_UNION_FIELD]).toBeCloseTo(0.7);
    expect(corrected['coverage-type'].current['journal-article'][FUNDING_UNION_FIELD]).toBeCloseTo(0.6);
    expect(corrected['coverage-type'].backfile['journal-article'][FUNDING_UNION_FIELD]).toBeCloseTo(0.8);
    const live = calculateMemberScore(corrected);
    const pair = buildBenchmarkSnapshots([corrected], '2026-10-19T00:00:00Z');
    expect(live.dimensions.funding.score).toBe(12);
    expect(pair.overall.leaderboard[0].score).toBe(live.total);
    expect(pair.current.leaderboard[0].score).toBe(live.trend.currentScore);
    expect(live.recommendations.some((item) => item.id === 'funders')).toBe(false);
  });

  it('credits the verified ROR-only publisher example without any work lookup', () => {
    const raw = member();
    for (const era of ['all', 'current', 'backfile'] as const) raw['coverage-type'][era]['journal-article'] = coverage(0, 10 / 21, 10 / 21);
    expect(needsFundingSupplement(raw)).toBe(false);
    expect(calculateScorableMemberScore(raw).current?.metricDetails.funding.score).toBe(9.52);
  });

  it('keeps unknown dates and future publications out of Current and Backfile supplements', () => {
    const counts = fundingOnlyCounts([{ ...work('10.test/no-date'), issued: undefined }, work('10.test/future', 2027)], 2026);
    expect(counts.get('123:all:journal-article')).toBe(2);
    expect(counts.has('123:current:journal-article')).toBe(false);
    expect(counts.has('123:backfile:journal-article')).toBe(false);
  });

  it('rejects impossible supplements rather than clipping them to 100%', () => {
    expect(() => completeFundingCoverage([member()], Array.from({ length: 20 }, (_, n) => work(`10.test/${n}`)), 2026)).toThrow('Inconsistent funding inputs');
  });
});
