/**
 * @nexus-score/core
 * Core library for Crossref metadata coverage scoring
 */

// Crossref API client and types
export {
  CrossrefClient,
  createCrossrefClient,
  type CrossrefClientOptions,
} from './crossref/client.js';

export {
  CrossrefAPIError,
  CrossrefNotFoundError,
  CrossrefRateLimitError,
  CrossrefTimeoutError,
} from './crossref/errors.js';
export { fundingCoverage, completeFundingCoverage, needsFundingSupplement, FUNDING_UNION_FIELD } from './crossref/funding.js';
export type { FundingOnlyWork } from './crossref/funding.js';

export type {
  CrossrefMember,
  CrossrefJournal,
  CrossrefWork,
  MemberCoverage,
  CoverageFields,
  MemberFlags,
  MemberPrefix,
  Author,
  Affiliation,
  AffiliationId,
  Funder,
  Reference,
  License,
  Link,
  DateParts,
  SearchResult,
  WorksResult,
  WorkType,
} from './crossref/types.js';

// Scoring engine
export {
  calculateMemberScore,
  METHODOLOGY_VERSION,
  UnscorableMemberError,
  calculateJournalScore,
  calculateScoreFromCoverage,
  calculateDimensionsForPeriod,
  calculateContentTypeScores,
  calculateScorableMemberScore,
  scoreFromSimplifiedCoverage,
  getMaxScore,
} from './scoring/calculator.js';

export {
  SCORABLE_CONTENT_TYPES,
  isScorableContentType,
} from './scoring/content-types.js';

export {
  DIMENSION_WEIGHTS,
  METRICS_BY_DIMENSION,
  GRADE_THRESHOLDS,
  STATUS_THRESHOLDS,
  TREND_THRESHOLD,
  PROVENANCE_METRICS,
  PEOPLE_METRICS,
  ORGANIZATIONS_METRICS,
  FUNDING_METRICS,
  ACCESS_METRICS,
  type MetricWeight,
} from './scoring/weights.js';

export type {
  NexusScore,
  DimensionScores,
  DimensionDetail,
  DimensionName,
  MetricDetail,
  MetricStatus,
  TrendInfo,
  TrendDirection,
  Recommendation,
  ScopedRecommendationSet,
  Priority,
  ScoreMetadata,
  Grade,
  DataSource,
  ContentTypeCoverage,
  ContentTypeScore,
  ContentTypeEraScore,
  ScorableEraScore,
  ScorableMemberScore,
} from './scoring/types.js';

// Recommendations
export {
  generateRecommendations,
  generateRecommendationsFromMetricDetails,
  getTopRecommendations,
  getRecommendationsByPriority,
  getTotalPotentialGain,
  groupRecommendationsByDimension,
} from './recommendations/engine.js';

export {
  RECOMMENDATION_TEMPLATES,
  getTemplateById,
  getTemplatesByDimension,
  type RecommendationTemplate,
} from './recommendations/templates.js';

// Institutional analysis (evidence-based Crossref classification)
export {
  analyzeInstitution,
  searchInstitutions,
} from './institution/index.js';

// Benchmark ranking
export { buildBenchmarkSnapshots, scopedBenchmark, summarizeBenchmark, compareBenchmarkEras } from './benchmark/snapshot.js';
export type { BenchmarkSnapshot, BenchmarkEntry, BenchmarkContentType, BenchmarkDimensions } from './benchmark/snapshot.js';
export { rankByScore, type CompetitionRank } from './ranking/competition.js';

export type {
  CoverageMetrics,
  PublisherGap,
  ProgressEvent,
  InstitutionReport,
} from './institution/index.js';
