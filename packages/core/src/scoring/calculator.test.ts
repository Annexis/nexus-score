import { describe, expect, it } from 'vitest';
import type { CrossrefJournal, CrossrefMember } from '../crossref/types.js';
import { calculateContentTypeScores, calculateJournalScore, calculateScorableMemberScore } from './calculator.js';
import { generateRecommendationsFromMetricDetails } from '../recommendations/engine.js';

type SimplifiedCoverage = Record<string, number>;

const zeroCoverage = (): SimplifiedCoverage => ({
  abstracts: 0,
  affiliations: 0,
  orcids: 0,
  licenses: 0,
  references: 0,
  funders: 0,
  'similarity-checking': 0,
  'award-numbers': 0,
  'ror-ids': 0,
  'funder-ror-ids': 0,
  'affiliation-ror-ids': 0,
  'update-policies': 0,
  'resource-links': 0,
});

const coverage = (
  overrides: Partial<SimplifiedCoverage> = {}
): SimplifiedCoverage => ({
  ...zeroCoverage(),
  ...overrides,
});

function asCoverageType(value: {
  all: Record<string, SimplifiedCoverage>;
  current?: Record<string, SimplifiedCoverage>;
  backfile?: Record<string, SimplifiedCoverage>;
}): CrossrefMember['coverage-type'] {
  return {
    all: value.all,
    current: value.current ?? {},
    backfile: value.backfile ?? {},
  } as unknown as CrossrefMember['coverage-type'];
}

describe('calculateContentTypeScores', () => {
  it('preserves all-years, current, and backfile metric details without changing scores', () => {
    const all = coverage({
      references: 0.8,
      'update-policies': 0.6,
      'similarity-checking': 0.4,
      orcids: 0.9,
      affiliations: 0.5,
      'ror-ids': 0.2,
      'affiliation-ror-ids': 0.2,
      funders: 0.3,
      'award-numbers': 0.1,
      licenses: 0.7,
      'resource-links': 0.6,
      abstracts: 0.5,
    });
    const current = coverage({ orcids: 0.97, references: 0.5 });
    const backfile = coverage({ orcids: 0.23, references: 0.2 });

    const [result] = calculateContentTypeScores(
      asCoverageType({
        all: { 'journal-article': all },
        current: { 'journal-article': current },
        backfile: { 'journal-article': backfile },
      }),
      {
        all: { 'journal-article': 1_000 },
        current: { 'journal-article': 100 },
        backfile: { 'journal-article': 900 },
      }
    );

    expect(result.score).toBe(56);
    expect(result.dimensions).toEqual({
      provenance: 68,
      people: 90,
      organizations: 30,
      funding: 20,
      access: 61,
    });
    expect(result.metricDetails.people.metrics[0]).toMatchObject({
      name: 'ORCID Coverage',
      value: 0.9,
      contribution: 18,
      maxContribution: 20,
      status: 'excellent',
    });
    expect(result.current?.score).toBe(27);
    expect(result.current?.metricDetails.people.metrics[0]).toMatchObject({
      value: 0.97,
      contribution: 19.4,
      status: 'excellent',
    });
    expect(result.backfile?.score).toBe(8);
    expect(result.backfile?.metricDetails.people.metrics[0]).toMatchObject({
      value: 0.23,
      contribution: 4.6,
      status: 'needs-work',
    });
  });

  it('handles arbitrary content-type keys and preserves all-zero types with works', () => {
    const results = calculateContentTypeScores(
      asCoverageType({
        all: {
          'custom-output': coverage({ abstracts: 0.75 }),
          'zero-output': zeroCoverage(),
        },
        current: {
          'custom-output': coverage({ abstracts: 0.8 }),
        },
      }),
      {
        all: { 'custom-output': 12, 'zero-output': 4 },
        current: { 'custom-output': 3, 'zero-output': 0 },
        backfile: { 'custom-output': 9, 'zero-output': 4 },
      }
    );

    const custom = results.find((result) => result.type === 'custom-output');
    const zero = results.find((result) => result.type === 'zero-output');

    expect(custom).toMatchObject({
      label: 'Custom Output',
      works: 12,
      scorable: false,
    });
    expect(custom?.metricDetails.access.metrics).toHaveLength(3);
    expect(custom?.current?.works).toBe(3);
    expect(custom?.backfile).toBeUndefined();

    expect(zero).toMatchObject({
      score: 0,
      grade: 'F',
      works: 4,
    });
    expect(zero?.current).toBeUndefined();
    expect(zero?.metricDetails.provenance.metrics.every((metric) => (
      metric.value === 0 && metric.status === 'poor'
    ))).toBe(true);
  });

  it('distinguishes an absent era from observed zero coverage with works', () => {
    const [result] = calculateContentTypeScores(
      asCoverageType({
        all: { 'future-type': zeroCoverage() },
        current: { 'future-type': zeroCoverage() },
      }),
      {
        all: { 'future-type': 8 },
        current: { 'future-type': 3 },
        backfile: { 'future-type': 5 },
      }
    );

    expect(result.current).toMatchObject({ score: 0, works: 3 });
    expect(result.current?.metricDetails.people.metrics[0]).toMatchObject({
      value: 0,
      contribution: 0,
      status: 'poor',
    });
    expect(result.backfile).toBeUndefined();
  });

  it('generates selected-scope recommendations from current metric details', () => {
    const [result] = calculateContentTypeScores(
      asCoverageType({
        all: { 'journal-article': coverage({ orcids: 0.8 }) },
        current: {
          'journal-article': coverage({
            orcids: 0.97,
            references: 0.98,
            affiliations: 1,
            'ror-ids': 0,
            'affiliation-ror-ids': 0,
            funders: 0.76,
            'award-numbers': 0.18,
            licenses: 1,
            'resource-links': 0.73,
            abstracts: 0.97,
            'update-policies': 0.73,
            'similarity-checking': 1,
          }),
        },
      }),
      { all: { 'journal-article': 100 }, current: { 'journal-article': 10 } }
    );

    const recommendations = generateRecommendationsFromMetricDetails(
      result.current!.metricDetails
    );

    expect(recommendations.some((recommendation) => recommendation.id === 'orcid-coverage')).toBe(false);
    expect(recommendations.some((recommendation) => recommendation.id === 'ror-ids')).toBe(true);
    expect(recommendations.some((recommendation) => recommendation.id === 'award-numbers')).toBe(true);
  });
});

describe('calculateJournalScore', () => {
  const journal = (currentWorks = 10, backfileWorks = 90) => ({
    ISSN: ['0000-0000'], title: 'Example Journal',
    counts: { 'current-dois': currentWorks, 'backfile-dois': backfileWorks, 'total-dois': currentWorks + backfileWorks },
    coverage: Object.fromEntries(['current', 'backfile'].flatMap((era) =>
      Object.entries(coverage({ orcids: era === 'current' ? 1 : 0, 'ror-ids': 1, 'funder-ror-ids': 1 }))
        .map(([key, value]) => [`${key}-${era}`, value]))),
  }) as unknown as CrossrefJournal;

  it('weights publication eras by work count and does not credit funder ROR as affiliation coverage', () => {
    const score = calculateJournalScore(journal());
    expect(score.total).toBe(12);
    expect(score.trend).toMatchObject({ currentScore: 30, backfileScore: 10, change: 20 });
    expect(score.dimensions.organizations.percentage).toBe(0);
  });

  it('preserves an absent backfile and refuses missing affiliation coverage', () => {
    expect(calculateJournalScore(journal(10, 0)).trend.backfileScore).toBeNull();
    const incomplete = journal();
    delete incomplete.coverage['affiliation-ror-ids-current'];
    expect(() => calculateJournalScore(incomplete)).toThrow('coverage is incomplete');
  });
});

describe('calculateScorableMemberScore', () => {
  it('weights supported work types by era and excludes incompatible schemas', () => {
    const member = {
      'coverage-type': asCoverageType({
        all: {
          'journal-article': coverage({ orcids: 0.4667 }),
          'peer-review': zeroCoverage(),
        },
        current: {
          'journal-article': coverage({ orcids: 1 }),
          'peer-review': zeroCoverage(),
        },
        backfile: {
          'journal-article': coverage({ orcids: 0.2 }),
          'peer-review': zeroCoverage(),
        },
      }),
      'counts-type': {
        all: { 'journal-article': 30, 'peer-review': 100 },
        current: { 'journal-article': 10, 'peer-review': 90 },
        backfile: { 'journal-article': 20, 'peer-review': 10 },
      },
    } as unknown as CrossrefMember;

    const result = calculateScorableMemberScore(member);

    expect(result.current).toMatchObject({ score: 20, works: 10, excludedWorks: 90 });
    expect(result.current?.coverage.orcids).toBe(1);
    expect(result.backfile).toMatchObject({ score: 4, works: 20, excludedWorks: 10 });
    expect(result.backfile?.coverage.orcids).toBe(0.2);
    expect(result.all).toMatchObject({ score: 9, works: 30, excludedWorks: 100 });
  });

  it('returns Not available rather than inventing zero coverage when an included type lacks coverage', () => {
    const member = {
      'coverage-type': asCoverageType({ all: {} }),
      'counts-type': {
        all: { 'journal-article': 2, 'peer-review': 5 },
        current: {},
        backfile: {},
      },
    } as unknown as CrossrefMember;

    expect(calculateScorableMemberScore(member).all).toBeNull();
  });
});
