/**
 * Scoring Types
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type MetricStatus = 'excellent' | 'good' | 'needs-work' | 'poor';
export type TrendDirection = 'up' | 'down' | 'stable';
export type Priority = 'high' | 'medium' | 'low';
export type DataSource = 'api-coverage' | 'sample-analysis' | 'leaderboard-cache';

export interface NexusScore {
  /** Total score out of 100 */
  total: number;
  /** Letter grade */
  grade: Grade;
  /** Breakdown by dimension */
  dimensions: DimensionScores;
  /** Trend comparing current vs backfile */
  trend: TrendInfo;
  /** Improvement suggestions */
  recommendations: Recommendation[];
  /** Score metadata */
  metadata: ScoreMetadata;
}

export interface DimensionScores {
  provenance: DimensionDetail;
  people: DimensionDetail;
  organizations: DimensionDetail;
  funding: DimensionDetail;
  access: DimensionDetail;
}

export type DimensionName = keyof DimensionScores;

export interface DimensionDetail {
  /** Points earned */
  score: number;
  /** Maximum possible points */
  maxScore: number;
  /** Percentage (0-100) */
  percentage: number;
  /** Individual metrics */
  metrics: MetricDetail[];
}

export interface MetricDetail {
  /** Human-readable name */
  name: string;
  /** API field key */
  key: string;
  /** Raw value (0-1 percentage from API) */
  value: number;
  /** Points contributed to score */
  contribution: number;
  /** Maximum possible contribution */
  maxContribution: number;
  /** Status indicator */
  status: MetricStatus;
}

export interface TrendInfo {
  /** Overall direction */
  direction: TrendDirection;
  /** Point change (current - backfile) */
  change: number | null;
  /** Score for works in Crossref's rolling current three-year window */
  currentScore: number | null;
  /** Score for works before Crossref's rolling current window */
  backfileScore: number | null;
}

export interface Recommendation {
  /** Unique identifier */
  id: string;
  /** Priority level */
  priority: Priority;
  /** Which dimension this improves */
  dimension: DimensionName;
  /** Which metric this addresses */
  metric: string;
  /** Short title */
  title: string;
  /** Explanation of why this matters */
  description: string;
  /** Current percentage (0-100) */
  currentValue: number;
  /** Target percentage (0-100) */
  targetValue: number;
  /** Estimated point gain */
  potentialGain: number;
  /** How to improve */
  howToImprove: string;
  /** Link to Crossref docs */
  documentationUrl: string;
}

export interface ScopedRecommendationSet {
  /** Crossref content type key, or "all" for the member-wide scope */
  contentType: string;
  /** Human-readable scope label */
  label: string;
  /** Recommendations deliberately focus on current deposit practice */
  era: 'current';
  /** Number of current works in scope, when Crossref provides it */
  works?: number;
  recommendations: Recommendation[];
}

export interface ScoreMetadata {
  /** Member/journal ID */
  entityId: number | string;
  /** Entity type */
  entityType: 'member' | 'journal';
  /** Display name */
  entityName: string;
  /** Location (city, region, country) */
  location?: string;
  /** When score was calculated */
  calculatedAt: string;
  /** Total DOI count */
  totalWorks: number;
  /** Current works count (current calendar year plus the preceding two) */
  currentWorks: number;
  /** Backfile works count */
  backfileWorks: number;
  /** How the score was calculated */
  dataSource: DataSource;
  /** Versioned definition used by the generated benchmarks and live API. */
  methodologyVersion?: string;
}

/**
 * Coverage fields as returned within coverage-type entries.
 * Uses simplified names (no era suffix).
 */
export interface ContentTypeCoverage {
  abstracts: number;
  affiliations: number;
  orcids: number;
  licenses: number;
  references: number;
  funders: number;
  'similarity-checking': number;
  'award-numbers': number;
  'ror-ids': number;
  'affiliation-ror-ids'?: number;
  'funder-ror-ids'?: number;
  /** Deduplicated existing funding metadata OR funder ROR, derived by the collector. */
  'funders-including-ror'?: number;
  'update-policies': number;
  'resource-links': number;
}

/**
 * Score for a single content type within one era (all/current/backfile).
 */
export interface ContentTypeEraScore {
  /** Weighted score 0-100 */
  score: number;
  /** Letter grade */
  grade: Grade;
  /** Per-dimension percentages (0-100) */
  dimensions: {
    provenance: number;
    people: number;
    organizations: number;
    funding: number;
    access: number;
  };
  /** Full per-metric scoring details for this content type and era */
  metricDetails: DimensionScores;
  /** Number of works of this type in this era, when counts are available */
  works?: number;
}

/**
 * Score calculated for a single content type (e.g., journal-article).
 * Top-level score/grade/dimensions reflect the "all years" period.
 */
export interface ContentTypeScore {
  /** Crossref content type key, e.g. 'journal-article' */
  type: string;
  /** Human-readable label, e.g. 'Journal Articles' */
  label: string;
  /** Whether this type is supported by Crossref Participation Reports */
  scorable: boolean;
  /** Weighted score 0-100 (all years) */
  score: number;
  /** Letter grade (all years) */
  grade: Grade;
  /** Per-dimension percentages (0-100, all years) */
  dimensions: {
    provenance: number;
    people: number;
    organizations: number;
    funding: number;
    access: number;
  };
  /** Full per-metric scoring details for this content type across all years */
  metricDetails: DimensionScores;
  /** Number of works of this type across all years, when counts are available */
  works?: number;
  /** Score for works in Crossref's rolling current three-year window */
  current?: ContentTypeEraScore;
  /** Score for works before Crossref's rolling current window */
  backfile?: ContentTypeEraScore;
}

/** A member-wide score aggregated only across Participation Report work types. */
export interface ScorableEraScore extends ContentTypeEraScore {
  /** Weighted metric coverage used to calculate this era score */
  coverage: ContentTypeCoverage;
  /** Number of supported works included in the calculation */
  works: number;
  /** Other registered Crossref records excluded because their schemas differ */
  excludedWorks: number;
}

export interface ScorableMemberScore {
  all: ScorableEraScore | null;
  current: ScorableEraScore | null;
  backfile: ScorableEraScore | null;
}
