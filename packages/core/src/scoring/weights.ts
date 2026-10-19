/**
 * Nexus Score Weights Configuration
 *
 * The Research Nexus vision emphasizes connections between:
 * - Works (publications)
 * - People (researchers via ORCID)
 * - Organizations (institutions via ROR)
 * - Funders (grants via Funder Registry)
 *
 * Weights reflect the importance of each metric to this vision.
 */

import type { DimensionName } from './types.js';

/**
 * Dimension weights (must sum to 100)
 */
export const DIMENSION_WEIGHTS: Record<DimensionName, number> = {
  provenance: 25, // Links to prior work, integrity
  people: 20, // Author identification
  organizations: 15, // Institutional links
  funding: 20, // Grant tracking
  access: 20, // Content availability
};

/**
 * Individual metric weights within dimensions
 */
export interface MetricWeight {
  name: string;
  key: string;
  weight: number;
}

export const PROVENANCE_METRICS: MetricWeight[] = [
  { name: 'References', key: 'references-current', weight: 15 },
  { name: 'Crossmark metadata', key: 'update-policies-current', weight: 5 },
  { name: 'Similarity Check URLs', key: 'similarity-checking-current', weight: 5 },
];

export const PEOPLE_METRICS: MetricWeight[] = [
  { name: 'ORCID Coverage', key: 'orcids-current', weight: 20 },
];

export const ORGANIZATIONS_METRICS: MetricWeight[] = [
  { name: 'Affiliations (Text)', key: 'affiliations-current', weight: 5 },
  { name: 'Affiliation ROR IDs', key: 'affiliation-ror-ids-current', weight: 10 },
];

export const FUNDING_METRICS: MetricWeight[] = [
  { name: 'Funding metadata', key: 'funders-current', weight: 10 },
  { name: 'Award Numbers', key: 'award-numbers-current', weight: 10 },
];

export const ACCESS_METRICS: MetricWeight[] = [
  { name: 'Licenses', key: 'licenses-current', weight: 7 },
  { name: 'Full-text Links', key: 'resource-links-current', weight: 7 },
  { name: 'Abstracts', key: 'abstracts-current', weight: 6 },
];

/**
 * All metrics by dimension
 */
export const METRICS_BY_DIMENSION: Record<DimensionName, MetricWeight[]> = {
  provenance: PROVENANCE_METRICS,
  people: PEOPLE_METRICS,
  organizations: ORGANIZATIONS_METRICS,
  funding: FUNDING_METRICS,
  access: ACCESS_METRICS,
};

/**
 * Grade thresholds
 */
export const GRADE_THRESHOLDS = {
  A: 80, // 80-100: Excellent
  B: 65, // 65-79: Good
  C: 50, // 50-64: Adequate
  D: 35, // 35-49: Needs Work
  F: 0, // 0-34: Poor
} as const;

/**
 * Status thresholds (for individual metrics)
 */
export const STATUS_THRESHOLDS = {
  excellent: 0.8, // 80%+
  good: 0.5, // 50-79%
  'needs-work': 0.2, // 20-49%
  poor: 0, // <20%
} as const;

/**
 * Trend threshold (minimum change to be considered "up" or "down")
 */
export const TREND_THRESHOLD = 2; // 2 points
