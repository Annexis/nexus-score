/**
 * Nexus Score Calculator
 * Calculates metadata coverage scores from Crossref member/journal data
 */

import type { CrossrefMember, CrossrefJournal, MemberCoverage } from '../crossref/types.js';
import type {
  NexusScore,
  DimensionScores,
  DimensionDetail,
  MetricDetail,
  MetricStatus,
  TrendInfo,
  Grade,
  DimensionName,
  ContentTypeCoverage,
  ContentTypeScore,
  ScorableEraScore,
  ScorableMemberScore,
} from './types.js';
import {
  METRICS_BY_DIMENSION,
  DIMENSION_WEIGHTS,
  GRADE_THRESHOLDS,
  STATUS_THRESHOLDS,
  TREND_THRESHOLD,
  type MetricWeight,
} from './weights.js';
import { generateRecommendationsFromMetricDetails } from '../recommendations/engine.js';
import { isScorableContentType } from './content-types.js';
import { fundingCoverage, FUNDING_UNION_FIELD } from '../crossref/funding.js';

/**
 * Calculate Nexus Score for a Crossref member (publisher)
 * Uses pre-computed coverage statistics from the API
 */
export const METHODOLOGY_VERSION = '2026-10-funding-union-v3';

export class UnscorableMemberError extends Error {
  constructor(public readonly member: CrossrefMember) {
    super('No complete coverage for supported Participation Report work types; this member is not benchmarked.');
    this.name = 'UnscorableMemberError';
  }
}

export function calculateMemberScore(member: CrossrefMember): NexusScore {
  const eras = calculateScorableMemberScore(member);
  if (!eras.all) throw new UnscorableMemberError(member);
  const change = eras.current && eras.backfile ? eras.current.score - eras.backfile.score : null;
  return {
    total: eras.all.score,
    grade: eras.all.grade,
    dimensions: eras.all.metricDetails,
    trend: {
      direction: change === null ? 'stable' : change > TREND_THRESHOLD ? 'up' : change < -TREND_THRESHOLD ? 'down' : 'stable',
      change,
      currentScore: eras.current?.score ?? null,
      backfileScore: eras.backfile?.score ?? null,
    },
    recommendations: eras.current ? generateRecommendationsFromMetricDetails(eras.current.metricDetails) : [],
    metadata: {
      entityId: member.id,
      entityType: 'member',
      entityName: member['primary-name'],
      location: member.location,
      calculatedAt: new Date().toISOString(),
      totalWorks: member.counts['total-dois'],
      currentWorks: eras.current?.works ?? 0,
      backfileWorks: eras.backfile?.works ?? 0,
      dataSource: 'api-coverage',
      methodologyVersion: METHODOLOGY_VERSION,
    },
  };
}

/**
 * Calculate Nexus Score for a journal
 */
export function calculateJournalScore(journal: CrossrefJournal): NexusScore {
  const readEra = (period: 'current' | 'backfile') => Object.fromEntries(
    [...Object.keys(SIMPLIFIED_FIELD_MAP), 'funder-ror-ids', FUNDING_UNION_FIELD].map((key) => [key,
      journal.coverage[`${key}-${period}` as keyof MemberCoverage]])) as Record<string, number>;
  const currentWorks = journal.counts['current-dois'];
  const backfileWorks = journal.counts['backfile-dois'];
  const currentCoverage = readEra('current');
  const backfileCoverage = readEra('backfile');
  if ((!currentWorks && !backfileWorks) || currentWorks > 0 && !hasCompleteCoverage(currentCoverage) ||
      backfileWorks > 0 && !hasCompleteCoverage(backfileCoverage)) {
    throw new Error('Journal coverage is incomplete, including affiliation-specific ROR coverage; no index is available.');
  }
  const overallCoverage = Object.fromEntries(Object.keys(SIMPLIFIED_FIELD_MAP).map((key) => [key,
    ((currentCoverage[key] ?? 0) * currentWorks + (backfileCoverage[key] ?? 0) * backfileWorks) / (currentWorks + backfileWorks)]));
  overallCoverage[FUNDING_UNION_FIELD] = ((currentWorks ? fundingCoverage(currentCoverage)! : 0) * currentWorks +
    (backfileWorks ? fundingCoverage(backfileCoverage)! : 0) * backfileWorks) / (currentWorks + backfileWorks);
  const overall = scoreFromSimplifiedCoverage(overallCoverage);
  const current = currentWorks ? scoreFromSimplifiedCoverage(currentCoverage) : null;
  const backfile = backfileWorks ? scoreFromSimplifiedCoverage(backfileCoverage) : null;
  const change = current && backfile ? current.score - backfile.score : null;
  return {
    total: overall.score, grade: scoreToGrade(overall.score), dimensions: overall.metricDetails,
    trend: { currentScore: current?.score ?? null, backfileScore: backfile?.score ?? null, change,
      direction: change === null ? 'stable' : change > TREND_THRESHOLD ? 'up' : change < -TREND_THRESHOLD ? 'down' : 'stable' },
    recommendations: current ? generateRecommendationsFromMetricDetails(current.metricDetails) : [],
    metadata: {
      entityId: journal.ISSN[0], entityType: 'journal', entityName: journal.title,
      calculatedAt: new Date().toISOString(), totalWorks: journal.counts['total-dois'],
      currentWorks, backfileWorks, dataSource: 'api-coverage', methodologyVersion: METHODOLOGY_VERSION,
    },
  };
}

/**
 * Calculate all dimension scores for a specific period
 */
export function calculateDimensionsForPeriod(
  coverage: MemberCoverage,
  period: 'current' | 'backfile'
): DimensionScores {
  return {
    provenance: calculateDimension('provenance', coverage, period),
    people: calculateDimension('people', coverage, period),
    organizations: calculateDimension('organizations', coverage, period),
    funding: calculateDimension('funding', coverage, period),
    access: calculateDimension('access', coverage, period),
  };
}

/**
 * Calculate a single dimension score for a specific period
 */
function calculateDimension(
  dimension: DimensionName,
  coverage: MemberCoverage,
  period: 'current' | 'backfile'
): DimensionDetail {
  const metrics = METRICS_BY_DIMENSION[dimension];
  const maxScore = DIMENSION_WEIGHTS[dimension];

  const metricDetails = metrics.map((metric) =>
    calculateMetric(metric, coverage, period)
  );

  const score = metricDetails.reduce((sum, m) => sum + m.contribution, 0);

  return {
    score: round(score),
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    metrics: metricDetails,
  };
}

/**
 * Calculate a single metric for a specific period
 */
function calculateMetric(
  metric: MetricWeight,
  coverage: MemberCoverage,
  period: 'current' | 'backfile'
): MetricDetail {
  const key = metric.key.replace('-current', `-${period}`) as keyof MemberCoverage;
  const value = metric.key === 'funders-current'
    ? fundingForPeriod(coverage, period)
    : (coverage[key] as number) || 0;
  const contribution = value * metric.weight;

  return {
    name: metric.name,
    key: metric.key,
    value: round(value),
    contribution: round(contribution),
    maxContribution: metric.weight,
    status: valueToStatus(value),
  };
}

/**
 * Convert a 0-100 score to a letter grade
 */
function scoreToGrade(score: number): Grade {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

/**
 * Convert a 0-1 value to a status
 */
function valueToStatus(value: number): MetricStatus {
  if (value >= STATUS_THRESHOLDS.excellent) return 'excellent';
  if (value >= STATUS_THRESHOLDS.good) return 'good';
  if (value >= STATUS_THRESHOLDS['needs-work']) return 'needs-work';
  return 'poor';
}

/**
 * Round to 2 decimal places
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get the maximum possible score (should always be 100)
 */
export function getMaxScore(): number {
  return Object.values(DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
}

/**
 * Calculate score from raw coverage values (utility function)
 */
export function calculateScoreFromCoverage(coverage: Partial<MemberCoverage>): number {
  let total = 0;

  for (const metrics of Object.values(METRICS_BY_DIMENSION)) {
    for (const metric of metrics) {
      const value = metric.key === 'funders-current'
        ? fundingForPeriod(coverage, 'current', true)
        : (coverage[metric.key as keyof MemberCoverage] as number) || 0;
      total += value * metric.weight;
    }
  }

  return Math.round(total);
}

function fundingForPeriod(coverage: Partial<MemberCoverage>, period: 'current' | 'backfile', partial = false): number {
  const values = Object.fromEntries(['funders', 'funder-ror-ids', FUNDING_UNION_FIELD].map((key) => [key,
    coverage[`${key}-${period}` as keyof MemberCoverage] ?? (partial && key !== FUNDING_UNION_FIELD ? 0 : undefined)]));
  const value = fundingCoverage(values);
  if (value === null) throw new Error('Funding identifier overlap is not resolved; use prepared scoring coverage.');
  return value;
}

// ============ CONTENT-TYPE SCORING ============

const CONTENT_TYPE_LABELS: Record<string, string> = {
  'journal-article': 'Journal Articles',
  'posted-content': 'Posted Content',
  'book-chapter': 'Book Chapters',
  'proceedings-article': 'Proceedings',
  'peer-review': 'Peer Reviews',
  'component': 'Components',
  'book': 'Books',
  'dataset': 'Datasets',
  'monograph': 'Monographs',
  'edited-book': 'Edited Books',
  'book-section': 'Book Sections',
  'reference-book': 'Reference Books',
  'report': 'Reports',
  'journal': 'Journals',
  'journal-issue': 'Journal Issues',
  'journal-volume': 'Journal Volumes',
  'book-part': 'Book Parts',
  'book-series': 'Book Series',
  'book-set': 'Book Sets',
  'dissertation': 'Dissertations',
  'standard': 'Standards',
  'other': 'Other',
};

/**
 * Map simplified coverage-type field names to the metric weight keys.
 * coverage-type entries use names like "abstracts" while our weights use "abstracts-current".
 */
const SIMPLIFIED_FIELD_MAP: Record<string, string> = {
  'references': 'references',
  'update-policies': 'update-policies',
  'similarity-checking': 'similarity-checking',
  'orcids': 'orcids',
  'affiliations': 'affiliations',
  'affiliation-ror-ids': 'affiliation-ror-ids',
  'funders': 'funders',
  'award-numbers': 'award-numbers',
  'licenses': 'licenses',
  'resource-links': 'resource-links',
  'abstracts': 'abstracts',
};

/**
 * Calculate a score from simplified coverage-type fields using the same weight system.
 */
function buildContentTypeMetricDetails(
  coverage: Record<string, number>,
  percentages: ContentTypeScore['dimensions'],
  funderCoverage: number
): DimensionScores {
  const result: Partial<DimensionScores> = {};

  for (const dimension of Object.keys(METRICS_BY_DIMENSION) as DimensionName[]) {
    const metrics = METRICS_BY_DIMENSION[dimension].map((metric) => {
      const simplifiedKey = metric.key.replace(/-current$/, '');
      const value = simplifiedKey === 'funders' ? funderCoverage : coverage[simplifiedKey] || 0;

      return {
        name: metric.name,
        key: metric.key,
        value: round(value),
        contribution: round(value * metric.weight),
        maxContribution: metric.weight,
        status: valueToStatus(value),
      };
    });

    result[dimension] = {
      score: round(metrics.reduce((sum, metric) => sum + metric.contribution, 0)),
      maxScore: DIMENSION_WEIGHTS[dimension],
      percentage: percentages[dimension],
      metrics,
    };
  }

  return result as DimensionScores;
}

export function scoreFromSimplifiedCoverage(coverage: Record<string, number>, benchmarked = true): {
  score: number;
  dimensions: { provenance: number; people: number; organizations: number; funding: number; access: number };
  metricDetails: DimensionScores;
} {
  // Calculate each dimension percentage
  const refVal = coverage['references'] || 0;
  const upVal = coverage['update-policies'] || 0;
  const simVal = coverage['similarity-checking'] || 0;
  const provenance = Math.round((refVal * 15 + upVal * 5 + simVal * 5) / 25 * 100);

  const people = Math.round((coverage['orcids'] || 0) * 100);

  const affVal = coverage['affiliations'] || 0;
  const rorVal = coverage['affiliation-ror-ids'] || 0;
  const organizations = Math.round((affVal * 5 + rorVal * 10) / 15 * 100);

  // Unsupported schemas retain legacy diagnostic fields only; their numeric
  // placeholders are never exposed as benchmark scores or included in ranks.
  const funVal = benchmarked ? fundingCoverage(coverage) : coverage.funders || 0;
  if (funVal === null) throw new Error('Funding identifier overlap is not resolved; collect the disjoint ROR cohort before scoring.');
  const awardVal = coverage['award-numbers'] || 0;
  const funding = Math.round((funVal * 10 + awardVal * 10) / 20 * 100);

  const licVal = coverage['licenses'] || 0;
  const linkVal = coverage['resource-links'] || 0;
  const absVal = coverage['abstracts'] || 0;
  const access = Math.round((licVal * 7 + linkVal * 7 + absVal * 6) / 20 * 100);

  const score = Math.round(
    (provenance * DIMENSION_WEIGHTS.provenance +
      people * DIMENSION_WEIGHTS.people +
      organizations * DIMENSION_WEIGHTS.organizations +
      funding * DIMENSION_WEIGHTS.funding +
      access * DIMENSION_WEIGHTS.access) / 100
  );

  const dimensions = { provenance, people, organizations, funding, access };

  return {
    score,
    dimensions,
    metricDetails: buildContentTypeMetricDetails(coverage, dimensions, funVal),
  };
}

/**
 * Extract the simplified coverage object for one content type in one era,
 * or null when there is no coverage entry.
 */
function getEraCoverage(
  eraData: Record<string, unknown> | undefined,
  type: string
): Record<string, number> | null {
  const coverage = eraData?.[type];
  if (!coverage || typeof coverage !== 'object') return null;

  // coverage-type entries use simplified field names (e.g., "abstracts" not "abstracts-current")
  // which don't match MemberCoverage's era-suffixed keys, so we cast through unknown
  return coverage as unknown as Record<string, number>;
}

function hasCompleteCoverage(values: Record<string, number>): boolean {
  return fundingCoverage(values) !== null && Object.keys(SIMPLIFIED_FIELD_MAP).every((key) => Number.isFinite(values[key]) && values[key] >= 0 && values[key] <= 1);
}

function coverageHasData(cov: Record<string, number>): boolean {
  return Object.keys(SIMPLIFIED_FIELD_MAP).some(
    (key) => typeof cov[key] === 'number' && cov[key] > 0
  );
}

/**
 * Calculate scores for each content type from Crossref coverage-type data.
 * Top-level score uses the "all" period; current/backfile era scores are
 * attached when that era applies.
 *
 * A type is included in the diagnostic breakdown when the member has works of
 * that type (counts-type), even if every returned coverage field is 0%.
 * `scorable` separately says whether the Participation Report methodology
 * applies; unsupported schemas remain visible but do not enter member totals.
 */
export function calculateContentTypeScores(
  coverageType: CrossrefMember['coverage-type'] | undefined,
  countsType?: CrossrefMember['counts-type']
): ContentTypeScore[] {
  if (!coverageType?.all) return [];

  const results: ContentTypeScore[] = [];

  for (const type of Object.keys(coverageType.all)) {
    const allCov = getEraCoverage(coverageType.all, type);
    if (!allCov) continue;
    if (isScorableContentType(type) && !hasCompleteCoverage(allCov)) continue;

    const worksAll = countsType?.all?.[type];
    const include =
      worksAll !== undefined ? worksAll > 0 : coverageHasData(allCov);
    if (!include) continue;

    const { score, dimensions, metricDetails } = scoreFromSimplifiedCoverage(allCov, isScorableContentType(type));

    const entry: ContentTypeScore = {
      type,
      label: CONTENT_TYPE_LABELS[type] || type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      scorable: isScorableContentType(type),
      score,
      grade: scoreToGrade(score),
      dimensions,
      metricDetails,
      works: worksAll,
    };

    for (const era of ['current', 'backfile'] as const) {
      const eraCov = getEraCoverage(coverageType[era], type);
      if (!eraCov) continue;
      if (isScorableContentType(type) && !hasCompleteCoverage(eraCov)) continue;

      const eraWorks = countsType?.[era]?.[type];
      const eraInclude =
        eraWorks !== undefined ? eraWorks > 0 : coverageHasData(eraCov);
      if (!eraInclude) continue;

      const eraScore = scoreFromSimplifiedCoverage(eraCov, isScorableContentType(type));
      entry[era] = {
        ...eraScore,
        grade: scoreToGrade(eraScore.score),
        works: eraWorks,
      };
    }

    results.push(entry);
  }

  // Sort by score descending, then by works so large zero-score types surface
  results.sort((a, b) => b.score - a.score || (b.works ?? 0) - (a.works ?? 0));
  return results;
}

function calculateScorableEra(
  member: CrossrefMember,
  era: 'all' | 'current' | 'backfile'
): ScorableEraScore | null {
  const counts = member['counts-type']?.[era];
  const coverage = member['coverage-type']?.[era];
  if (!counts || !coverage) return null;

  const included = Object.entries(counts).filter(
    ([type, works]) => isScorableContentType(type) && works > 0
  );
  const works = included.reduce((sum, [, count]) => sum + count, 0);
  if (works === 0) return null;

  // Missing coverage is missing data, not observed 0%. Do not manufacture a score.
  if (included.some(([type]) => {
    const values = getEraCoverage(coverage as unknown as Record<string, unknown>, type);
    return !values || !hasCompleteCoverage(values);
  })) {
    return null;
  }

  const weightedCoverage = Object.fromEntries(
    [...Object.keys(SIMPLIFIED_FIELD_MAP), 'ror-ids', FUNDING_UNION_FIELD, ...
      (included.every(([type]) => Number.isFinite((coverage as unknown as Record<string, Record<string, number>>)[type]['funder-ror-ids'])) ? ['funder-ror-ids'] : [])].map((key) => {
      const numerator = included.reduce((sum, [type, count]) => {
        const typeCoverage = getEraCoverage(coverage as unknown as Record<string, unknown>, type)!;
        return sum + (key === FUNDING_UNION_FIELD ? fundingCoverage(typeCoverage)! : typeCoverage[key] ?? 0) * count;
      }, 0);
      return [key, numerator / works];
    })
  ) as unknown as ContentTypeCoverage;

  const scored = scoreFromSimplifiedCoverage(
    weightedCoverage as unknown as Record<string, number>
  );
  const registeredWorks = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return {
    ...scored,
    grade: scoreToGrade(scored.score),
    coverage: weightedCoverage,
    works,
    excludedWorks: Math.max(0, registeredWorks - works),
  };
}

/**
 * Calculate the generic member-wide view from Crossref Participation Report
 * work types only. This prevents schema-specific records such as peer reviews
 * from being interpreted as 0% coverage for inapplicable article metadata.
 */
export function calculateScorableMemberScore(member: CrossrefMember): ScorableMemberScore {
  return {
    all: calculateScorableEra(member, 'all'),
    current: calculateScorableEra(member, 'current'),
    backfile: calculateScorableEra(member, 'backfile'),
  };
}
